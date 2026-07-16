import React, { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase.js";
import { parseWorkbook } from "../lib/parser.js";
import { currentMonthOf, aggregates } from "../lib/compute.js";

export default function PlansList({ me, onOpen }) {
  const [plans, setPlans] = useState(null);
  const [err, setErr] = useState("");
  const [preview, setPreview] = useState(null); // {parsed, file}
  const [startYear, setStartYear] = useState(new Date().getFullYear());
  const [startMonth, setStartMonth] = useState(1);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  const load = async () => {
    const { data, error } = await supabase
      .from("plans")
      .select("*, indicators(id, tasks(id, month_no, status))")
      .order("created_at", { ascending: false });
    if (error) setErr(error.message);
    setPlans(data || []);
  };
  useEffect(() => { load(); }, []);

  const pick = (file) => {
    setErr("");
    const rd = new FileReader();
    rd.onload = (e) => {
      try { setPreview({ parsed: parseWorkbook(e.target.result, file.name), file }); }
      catch (ex) { setErr(ex.message); }
    };
    rd.readAsArrayBuffer(file);
  };

  const commit = async () => {
    setBusy(true); setErr("");
    try {
      const { parsed, file } = preview;
      // 1) رفع الملف الأصلي إلى المخزن (باسم آمن)
      const safeName = file.name.replace(/[^\w.\-]/g, "_") || "plan.xlsx";
      const path = `${me.id}/${Date.now()}_${safeName}`;
      const up = await supabase.storage.from("plans").upload(path, file);
      if (up.error) throw up.error;
      // 2) إنشاء الخطة
      const { data: plan, error: pe } = await supabase.from("plans").insert({
        name: parsed.name, months_count: parsed.months,
        start_year: Number(startYear), start_month: Number(startMonth),
        owner_id: me.id, source_path: path,
      }).select().single();
      if (pe) throw pe;
      // 3) عضوية المالك كمدير
      await supabase.from("plan_members").insert({ plan_id: plan.id, user_id: me.id, role: "manager" });
      // 4) المؤشرات ثم المهام
      const { data: inds, error: ie } = await supabase.from("indicators").insert(
        parsed.indicators.map((i) => ({ plan_id: plan.id, name: i.name, total_target: i.target, sort_order: i.sort }))
      ).select();
      if (ie) throw ie;
      const byName = Object.fromEntries(inds.map((i) => [i.name + "|" + i.sort_order, i.id]));
      const taskRows = [];
      parsed.indicators.forEach((i) => {
        const iid = byName[i.name + "|" + i.sort];
        i.tasks.forEach((t) => taskRows.push({ indicator_id: iid, month_no: t.month, description: t.desc }));
      });
      const { error: te } = await supabase.from("tasks").insert(taskRows);
      if (te) throw te;
      setPreview(null);
      await load();
      onOpen(plan.id);
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  const removePlan = async (p) => {
    const sure = window.confirm(
      `تحذير: سيُحذف نهائياً كل ما يخص الخطة «${p.name}» — المؤشرات والمهام والإسنادات وسجل التغييرات — ولا يمكن التراجع.\n\nهل أنت متأكد من الحذف؟`
    );
    if (!sure) return;
    setErr("");
    try {
      if (p.source_path) await supabase.storage.from("plans").remove([p.source_path]);
      const { error } = await supabase.from("plans").delete().eq("id", p.id);
      if (error) throw error;
      await load();
    } catch (e) {
      setErr(e.message.includes("row-level security")
        ? "لا تملك صلاحية حذف هذه الخطة — الحذف لصاحب الخطة فقط."
        : e.message);
    }
  };

  return (
    <>
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>خططي</div>
            <div className="mut">ارفع خطة جديدة وفق القالب المعتمد (12–60 شهراً)</div>
          </div>
          <button className="btn btn-primary" onClick={() => fileRef.current.click()}>رفع خطة جديدة</button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" hidden
            onChange={(e) => { if (e.target.files[0]) pick(e.target.files[0]); e.target.value = ""; }} />
        </div>
        {err && <div className="alert-err" style={{ marginTop: 12 }}>⚠ {err}</div>}
      </div>

      {preview && (
        <div className="card" style={{ borderColor: "var(--teal)" }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>معاينة قبل الاعتماد: {preview.parsed.name}</div>
          <div className="mut" style={{ marginBottom: 8 }}>
            {preview.parsed.indicators.length} مؤشرات · {preview.parsed.indicators.reduce((a, i) => a + i.tasks.length, 0)} مهمة · {preview.parsed.months} شهراً
          </div>
          {preview.parsed.warnings.length > 0 && (
            <div className="alert-warn" style={{ marginBottom: 10 }}><b>ملاحظات التحقق:</b> {preview.parsed.warnings.join(" · ")}</div>
          )}
          <div className="row" style={{ marginBottom: 12 }}>
            <label className="mut">سنة بداية الخطة:</label>
            <input className="input" style={{ width: 110 }} dir="ltr" type="number" value={startYear} onChange={(e) => setStartYear(e.target.value)} />
            <label className="mut">شهر البداية:</label>
            <select className="input" style={{ width: 90 }} value={startMonth} onChange={(e) => setStartMonth(e.target.value)}>
              {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
            </select>
          </div>
          <div className="row">
            <button className="btn btn-primary" disabled={busy} onClick={commit}>{busy ? "جارٍ الاعتماد…" : "اعتماد ورفع"}</button>
            <button className="btn btn-ghost" onClick={() => setPreview(null)}>إلغاء</button>
          </div>
        </div>
      )}

      {plans === null ? <div className="mut">جارٍ التحميل…</div> : plans.length === 0 ? (
        <div className="card" style={{ textAlign: "center", color: "var(--mut)" }}>
          لا توجد خطط بعد — ارفع أول خطة لتبدأ المتابعة.
        </div>
      ) : plans.map((p) => {
        const tasks = (p.indicators || []).flatMap((i) => i.tasks || []);
        const cur = currentMonthOf(p);
        const ag = aggregates(tasks, cur);
        const clr = ag.late ? "var(--red)" : ag.now ? "var(--amber)" : ag.pct === 100 && ag.total ? "var(--teal)" : "var(--teal-mid)";
        return (
          <div key={p.id} className="card" style={{ cursor: "pointer", borderRight: `5px solid ${clr}` }} onClick={() => onOpen(p.id)}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <div className="grow">
                <div style={{ fontWeight: 700 }}>{p.name}</div>
                <div className="mut">{p.months_count} شهراً · تبدأ {p.start_month}/{p.start_year} · الشهر الجاري: {cur}</div>
              </div>
              <div className="row" style={{ gap: 6 }}>
                <button className="btn btn-ghost" onClick={(e) => { e.stopPropagation(); onOpen(p.id); }}>فتح ←</button>
                <button className="btn btn-ghost" style={{ color: "var(--red)" }}
                  title="حذف الخطة نهائياً"
                  onClick={(e) => { e.stopPropagation(); removePlan(p); }}>حذف</button>
              </div>
            </div>
            <div className="row" style={{ marginTop: 10 }}>
              <div className="progress"><div style={{ width: `${ag.pct}%`, background: clr }} /></div>
              <span style={{ fontWeight: 700, fontSize: 13, color: clr }}>{ag.pct}%</span>
              <span className="mut">المحقق {ag.done} من {ag.total}</span>
              {ag.late > 0 && <span className="badge b-late">{ag.late} متأخرة</span>}
              {ag.now > 0 && <span className="badge b-now">{ag.now} مستحقة هذا الشهر</span>}
            </div>
          </div>
        );
      })}
    </>
  );
}
