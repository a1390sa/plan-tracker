import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase.js";

const TYPE_AR = { move_month: "نقل شهر", edit_desc: "تعديل وصف", reassign: "إعادة إسناد", cancel: "إلغاء مهمة" };
const ST_AR = { pending: "بانتظار الاعتماد", approved: "معتمد", rejected: "مرفوض" };

export default function ChangesTab({ planId, me, isManager, names, onApplied }) {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState("");

  const load = async () => {
    const { data, error } = await supabase
      .from("task_changes")
      .select("*, task:tasks(id, description, month_no, indicator:indicators(plan_id, name))")
      .order("created_at", { ascending: false });
    if (error) { setErr(error.message); return; }
    setRows((data || []).filter((r) => r.task?.indicator?.plan_id === planId));
  };
  useEffect(() => { load(); }, [planId]);

  const decide = async (row, approve) => {
    setErr("");
    try {
      if (approve) {
        // تطبيق أثر التغيير على المهمة
        if (row.change_type === "move_month")
          await supabase.from("tasks").update({ month_no: Number(row.new_value) }).eq("id", row.task_id);
        else if (row.change_type === "edit_desc")
          await supabase.from("tasks").update({ description: row.new_value }).eq("id", row.task_id);
        else if (row.change_type === "cancel")
          await supabase.from("tasks").update({ status: "cancelled" }).eq("id", row.task_id);
      }
      const { error } = await supabase.from("task_changes").update({
        status: approve ? "approved" : "rejected",
        approved_by: me.id, decided_at: new Date().toISOString(),
      }).eq("id", row.id);
      if (error) throw error;
      await load(); onApplied();
    } catch (e) { setErr(e.message); }
  };

  if (err) return <div className="alert-err">⚠ {err}</div>;
  if (rows === null) return <div className="mut">جارٍ التحميل…</div>;
  if (!rows.length) return <div className="card" style={{ textAlign: "center", color: "var(--mut)" }}>لا توجد طلبات تغيير — سجل التغييرات نظيف.</div>;

  return (
    <div className="card" style={{ padding: 0, overflow: "auto" }}>
      <table className="tbl">
        <thead>
          <tr><th>المهمة</th><th>النوع</th><th>قبل ← بعد</th><th>السبب</th><th>مقدّم الطلب</th><th>الحالة</th><th></th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td style={{ maxWidth: 220 }}>{r.task?.description}<div className="mut" style={{ fontSize: 11 }}>{r.task?.indicator?.name}</div></td>
              <td>{TYPE_AR[r.change_type]}</td>
              <td className="mut">
                {r.change_type === "cancel" ? "—" : <>{r.old_value} ← <b style={{ color: "var(--ink)" }}>{r.new_value}</b></>}
              </td>
              <td style={{ maxWidth: 180 }} className="mut">{r.reason}</td>
              <td>{names[r.requested_by] || "عضو"}</td>
              <td>
                <span className={`badge ${r.status === "approved" ? "b-done" : r.status === "rejected" ? "b-late" : "b-now"}`}>{ST_AR[r.status]}</span>
                {r.approved_by && <div className="mut" style={{ fontSize: 10, marginTop: 3 }}>بقرار: {names[r.approved_by] || "المدير"}</div>}
              </td>
              <td>
                {r.status === "pending" && isManager && (
                  <div className="row" style={{ gap: 6 }}>
                    <button className="btn btn-primary" style={{ padding: "4px 10px", fontSize: 12 }} onClick={() => decide(r, true)}>اعتماد</button>
                    <button className="btn" style={{ padding: "4px 10px", fontSize: 12, color: "var(--red)" }} onClick={() => decide(r, false)}>رفض</button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
