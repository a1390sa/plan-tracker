// المحلّل الذكي ٢.٠ — يكتشف بنية الملف تلقائياً
// يدعم: تعدد الأوراق، مواضع أعمدة مختلفة، أشهراً مفردة أو مزدوجة،
// أسماء الشهور العربية، «المهام/المهمة»، ترتيباً مرناً لصفوف الكتلة،
// مؤشرات كمية بلا مهام نصية، وعلامة «تم» للمنجز.
import * as XLSX from "xlsx";

const AR_MONTHS = { "يناير":1,"فبراير":2,"مارس":3,"أبريل":4,"ابريل":4,"مايو":5,"يونيو":6,"يوليو":7,"أغسطس":8,"اغسطس":8,"سبتمبر":9,"أكتوبر":10,"اكتوبر":10,"نوفمبر":11,"ديسمبر":12 };
const clean = (v) => String(v ?? "").replace(/\s+/g, " ").trim();

function monthFromHeader(v) {
  if (typeof v === "number" && v >= 1 && v <= 12) return v;
  const s = clean(v);
  if (!s) return null;
  const digits = s.match(/\d+/);
  for (const [name, n] of Object.entries(AR_MONTHS))
    if (s.includes(name)) return digits ? Math.min(Number(digits[0]), 12) || n : n;
  if (/^\d{1,2}$/.test(s)) { const n = Number(s); if (n >= 1 && n <= 12) return n; }
  return null;
}

function detectSheet(wb) {
  for (const name of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: null });
    for (let r = 0; r < Math.min(rows.length, 8); r++) {
      const row = rows[r] || [];
      let labelCol = -1, targetCol = -1;
      row.forEach((v, c) => {
        const s = clean(v);
        if (s === "التنفيذ") labelCol = c;
        if (targetCol < 0 && s.startsWith("المستهدف")) targetCol = c;
      });
      if (labelCol >= 0 && targetCol >= 0 && targetCol < labelCol) {
        // عمود المؤشر: أقرب عمود عن يمين المستهدف ترويسته تتضمن «مؤشر»، وإلا فالذي قبله مباشرة
        let indCol = -1;
        for (let c = targetCol - 1; c >= 0; c--)
          if (clean(row[c]).includes("مؤشر")) { indCol = c; break; }
        if (indCol < 0) indCol = Math.max(targetCol - 1, 0);
        return { rows, headerRow: r, indCol, targetCol, labelCol, sheet: name };
      }
    }
  }
  throw new Error("الملف لا يطابق أي بنية معروفة: لم يُعثر في أي ورقة على ترويسة تضم «المستهدف» و«التنفيذ».");
}

function detectMonths(rows, headerRow, labelCol) {
  const hdr = rows[headerRow] || [];
  const cols = []; // {col, m}
  let started = false;
  for (let c = labelCol + 1; c < Math.max(hdr.length, labelCol + 40); c++) {
    const m = monthFromHeader(hdr[c]);
    if (m !== null) { cols.push({ col: c, m }); started = true; }
    else if (hdr[c] != null && clean(hdr[c]) !== "" && started) break; // ترويسة خلاصة → توقف
  }
  if (!cols.length) throw new Error("لم يُعثر على أعمدة الأشهر بعد عمود «التنفيذ».");
  // ترقيم تسلسلي يدعم تعدد السنوات (1..12 ثم 1..12 → 1..24)
  const months = cols.map((c, i) => ({ ...c, seq: i + 1 }));
  // نطاق بيانات كل شهر: من عموده إلى ما قبل عمود الشهر التالي (يشمل عمود «تم» في الأزواج)
  months.forEach((mo, i) => { mo.end = (i + 1 < months.length ? months[i + 1].col : mo.col + 2) - 1; });
  return months;
}

const LBL = (s) => {
  s = clean(s);
  if (s === "المستهدف الشهري") return "target";
  if (s === "المهام" || s === "المهمة") return "tasks";
  if (s === "المحقق") return "done";
  if (s === "النسبة") return "pct";
  return s ? "other" : "";
};

export function parseWorkbook(arrayBuffer, fileName) {
  const wb = XLSX.read(new Uint8Array(arrayBuffer), { type: "array" });
  const { rows, headerRow, indCol, targetCol, labelCol, sheet } = detectSheet(wb);
  const months = detectMonths(rows, headerRow, labelCol);
  const monthsCount = months.length;
  const warnings = [];
  if (monthsCount % 12 !== 0 || monthsCount < 12 || monthsCount > 60)
    warnings.push(`عدد الأشهر المكتشف ${monthsCount} — المعتمد من 12 إلى 60 بمضاعفات السنة.`);
  if (wb.SheetNames.length > 1)
    warnings.push(`الملف متعدد الأوراق — قُرئت ورقة «${sheet}».`);

  // تجميع الكتل: كتلة جديدة عند قيمة في عمود المؤشر
  const blocks = [];
  for (let r = headerRow + 1; r < rows.length; r++) {
    const row = rows[r] || [];
    const indName = clean(row[indCol]);
    if (indName) blocks.push({ name: indName, target: Number(row[targetCol]) || 0, rows: [r] });
    else if (blocks.length) blocks[blocks.length - 1].rows.push(r);
  }
  if (!blocks.length) throw new Error("لم يُعثر على أي مؤشر في عمود المؤشرات.");

  const indicators = [];
  for (const b of blocks) {
    const ind = { name: b.name, target: b.target, sort: indicators.length, tasks: [] };
    const monthlyTargets = {}; // للمؤشرات الكمية بلا مهام نصية
    let mode = ""; // تصنيف الصفوف غير المُعنونة تبعاً لآخر عنوان
    for (const r of b.rows) {
      const row = rows[r] || [];
      const lbl = LBL(row[labelCol]);
      if (lbl && lbl !== "other") mode = lbl;
      else if (lbl === "other") mode = "other";
      if (mode === "target") {
        for (const mo of months) {
          const v = row[mo.col];
          if (typeof v === "number" && v > 0) monthlyTargets[mo.seq] = (monthlyTargets[mo.seq] || 0) + v;
        }
      } else if (mode === "tasks") {
        for (const mo of months) {
          let desc = "", done = false;
          for (let c = mo.col; c <= mo.end; c++) {
            const v = row[c];
            const s = clean(v);
            if (!s || typeof v === "number") continue;
            if (s === "تم" || s === "منجز" || s === "منجزة") { done = true; continue; }
            if (!desc) desc = s;
          }
          if (desc) ind.tasks.push({ month: mo.seq, desc, done });
        }
      }
      // صفوف «المحقق» و«النسبة» لا تُقرأ — يحسبها النظام
    }
    // مؤشر كمي بلا مهام نصية: نولّد مهمة شهرية من المستهدفات الرقمية
    if (!ind.tasks.length && Object.keys(monthlyTargets).length) {
      for (const [m, n] of Object.entries(monthlyTargets))
        ind.tasks.push({ month: Number(m), desc: `${ind.name} — مستهدف الشهر: ${n}`, done: false, qty: n });
      const sum = Object.values(monthlyTargets).reduce((a, x) => a + x, 0);
      if (!ind.target) ind.target = sum;
      if (ind.target && sum !== ind.target)
        warnings.push(`«${ind.name}»: مجموع المستهدفات الشهرية ${sum} لا يساوي المستهدف الكلي ${ind.target}.`);
    } else if (ind.target && ind.tasks.length && ind.tasks.length !== ind.target) {
      const sum = Object.values(monthlyTargets).reduce((a, x) => a + x, 0);
      if (sum !== ind.target)
        warnings.push(`«${ind.name}»: المستهدف ${ind.target} بينما عدد المهام ${ind.tasks.length}.`);
    }
    if (!ind.tasks.length) warnings.push(`المؤشر «${ind.name}» بلا مهام ولا مستهدفات شهرية — أُدرج فارغاً.`);
    indicators.push(ind);
  }

  const name = fileName.replace(/\.xlsx?$/i, "").replace(/_/g, " ");
  return { name, months: monthsCount, indicators, warnings };
}
