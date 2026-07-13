// محلّل القالب المعتمد ١.٢ — يقرأ ملف الإكسل ويعيد بنية الخطة
import * as XLSX from "xlsx";

export function parseWorkbook(arrayBuffer, fileName) {
  const wb = XLSX.read(new Uint8Array(arrayBuffer), { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
  const warnings = [];
  const hdr = rows[1] || [];

  if (String(hdr[0] || "").trim() !== "المؤشر" || String(hdr[1] || "").trim() !== "المستهدف")
    throw new Error("الملف لا يطابق القالب المعتمد: لم يُعثر على ترويسة «المؤشر / المستهدف» في الصف الثاني.");

  const monthCols = [];
  for (let c = 3; c < hdr.length; c++) {
    const v = hdr[c];
    if (typeof v === "number") monthCols.push(c);
    else if (typeof v === "string" && v.includes("القراءة")) break;
  }
  const months = monthCols.length;
  if (months % 12 !== 0 || months < 12 || months > 60)
    throw new Error(`عدد الأشهر المكتشف ${months} — المعتمد من 12 إلى 60 شهراً بمضاعفات السنة الكاملة.`);
  const colToMonth = {};
  monthCols.forEach((c, i) => { colToMonth[c] = i + 1; });

  const indicators = [];
  for (let r = 2; r < rows.length; r++) {
    const row = rows[r] || [];
    if (row[0] == null) continue;
    const ind = { name: String(row[0]).trim(), target: Number(row[1]) || 0, sort: indicators.length, tasks: [] };
    let tr = r + 1;
    while (tr < rows.length && String((rows[tr] || [])[2] || "").trim() !== "المهام") {
      if ((rows[tr] || [])[0] != null) break;
      tr++;
    }
    while (tr < rows.length) {
      const trow = rows[tr] || [];
      const lbl = String(trow[2] || "").trim();
      if (lbl === "المحقق" || lbl === "النسبة" || trow[0] != null) break;
      for (const c of monthCols) {
        const v = trow[c];
        if (v != null && String(v).trim() !== "" && typeof v !== "number")
          ind.tasks.push({ month: colToMonth[c], desc: String(v).trim() });
      }
      tr++;
    }
    if (!ind.tasks.length) warnings.push(`المؤشر «${ind.name}» بلا مهام.`);
    if (ind.target && ind.tasks.length !== ind.target)
      warnings.push(`«${ind.name}»: المستهدف ${ind.target} بينما عدد المهام ${ind.tasks.length}.`);
    indicators.push(ind);
  }
  if (!indicators.length) throw new Error("لم يُعثر على أي مؤشر في العمود الأول.");
  const name = fileName.replace(/\.xlsx?$/i, "").replace(/_/g, " ");
  return { name, months, indicators, warnings };
}
