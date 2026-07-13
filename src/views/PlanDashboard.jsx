import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase.js";
import { currentMonthOf, taskState, stTxt, aggregates } from "../lib/compute.js";
import ChangesTab from "./ChangesTab.jsx";
import MembersTab from "./MembersTab.jsx";

const stClass = { done: "b-done", late: "b-late", now: "b-now", future: "b-future", cancelled: "b-cancelled" };

function AssignPanel({ task, members, canManage, onChange }) {
  const primary = task.assignments.find((a) => a.role === "primary");
  const support = task.assignments.filter((a) => a.role === "support").map((a) => a.user_id);

  const setPrimary = async (uid) => {
    if (primary) await supabase.from("task_assignments").delete().eq("id", primary.id);
    if (uid) {
      await supabase.from("task_assignments").delete().eq("task_id", task.id).eq("user_id", uid);
      await supabase.from("task_assignments").insert({ task_id: task.id, user_id: uid, role: "primary" });
    }
    onChange();
  };
  const toggleSupport = async (uid) => {
    const ex = task.assignments.find((a) => a.role === "support" && a.user_id === uid);
    if (ex) await supabase.from("task_assignments").delete().eq("id", ex.id);
    else await supabase.from("task_assignments").insert({ task_id: task.id, user_id: uid, role: "support" });
    onChange();
  };

  return (
    <div style={{ padding: "10px 14px 12px", background: "#FAFBFA", borderTop: "1px dashed var(--line)" }}>
      <div className="row">
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--teal)", minWidth: 88 }}>المسؤول الرئيس:</span>
        <select className="input" style={{ width: "auto", fontWeight: 700 }} disabled={!canManage}
          value={primary?.user_id || ""} onChange={(e) => setPrimary(e.target.value || null)}>
          <option value="">اختر الرئيس (إلزامي)</option>
          {members.map((m) => <option key={m.user_id} value={m.user_id}>{m.profile.name}</option>)}
        </select>
        {!primary && <span className="badge" style={{ color: "var(--sand-ink)", background: "var(--sand-soft)" }}>لا تدخل دورة التنبيهات قبل تعيين رئيس</span>}
      </div>
      <div className="row" style={{ marginTop: 10, alignItems: "flex-start" }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--mut)", minWidth: 88, paddingTop: 4 }}>المساندون:</span>
        <div className="row" style={{ gap: 6 }}>
          {members.filter((m) => m.user_id !== primary?.user_id).map((m) => {
            const on = support.includes(m.user_id);
            return (
              <button key={m.user_id} className={`chip ${on ? "on" : ""}`} disabled={!canManage}
                onClick={() => toggleSupport(m.user_id)}>
                {on ? "✓ " : "＋ "}{m.profile.name}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function TaskRow({ task, cur, me, isManager, members, names, onRefresh, onRequestChange }) {
  const [open, setOpen] = useState(false);
  const st = taskState(task, cur);
  const primary = task.assignments.find((a) => a.role === "primary");
  const support = task.assignments.filter((a) => a.role === "support");
  const isPrimaryMe = primary?.user_id === me.id;
  const canToggle = task.status !== "cancelled" && (isPrimaryMe || isManager);

  const toggleDone = async () => {
    const done = task.status !== "done";
    await supabase.from("tasks").update({
      status: done ? "done" : "pending",
      completed_at: done ? new Date().toISOString() : null,
    }).eq("id", task.id);
    onRefresh();
  };

  return (
    <div style={{ borderTop: "1px solid var(--line)", background: st === "late" ? "var(--red-soft)" : "transparent" }}>
      <div className="taskrow">
        <input type="checkbox" checked={task.status === "done"} disabled={!canToggle}
          title={canToggle ? "تحديث الحالة" : "يحدّثها المسؤول الرئيس أو مدير الخطة"}
          onChange={toggleDone} style={{ width: 17, height: 17, accentColor: "var(--teal)" }} />
        <div className="grow">
          <div style={{ fontSize: 13, textDecoration: task.status === "done" || task.status === "cancelled" ? "line-through" : "none", color: task.status === "done" ? "var(--mut)" : "var(--ink)" }}>
            {task.description}
          </div>
          <div className="mut" style={{ marginTop: 2, fontSize: 11 }}>
            شهر {task.month_no}
            {primary && <> · <b style={{ color: "var(--teal)" }}>الرئيس: {names[primary.user_id]}</b></>}
            {support.length > 0 && <> · يسانده: {support.map((s) => names[s.user_id]).join("، ")}</>}
          </div>
        </div>
        <span className={`badge ${stClass[st]}`}>{stTxt[st]}</span>
        {task.status !== "cancelled" && (
          <button className="btn btn-ghost" style={{ padding: "5px 10px", fontSize: 12 }} onClick={() => onRequestChange(task)}>طلب تغيير</button>
        )}
        {isManager && (
          <button className={`btn ${!primary ? "btn-sand" : "btn-ghost"}`} style={{ padding: "5px 10px", fontSize: 12 }} onClick={() => setOpen(!open)}>
            {!primary ? "⚠ إسناد" : open ? "إغلاق" : "الإسناد"}
          </button>
        )}
      </div>
      {open && <AssignPanel task={task} members={members} canManage={isManager} onChange={onRefresh} />}
    </div>
  );
}

function IndicatorCard({ ind, cur, filter, ...rest }) {
  const [open, setOpen] = useState(false);
  const tasks = filter ? ind.tasks.filter((t) => t.month_no === filter) : ind.tasks;
  const ag = aggregates(ind.tasks, cur);
  const clr = ag.late ? "var(--red)" : ag.now ? "var(--amber)" : ag.done === ag.total && ag.total ? "var(--teal)" : "var(--teal-mid)";
  if (filter && !tasks.length) return null;
  return (
    <div className="card" style={{ padding: 0, borderRight: `5px solid ${clr}`, overflow: "hidden" }}>
      <div style={{ padding: "14px 16px", cursor: "pointer" }} onClick={() => setOpen(!open)}>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
          <div style={{ fontWeight: 700, fontSize: 14, flex: 1 }}>{ind.name}</div>
          <span className="mut">{open ? "إخفاء ▲" : "المهام ▼"}</span>
        </div>
        <div className="row" style={{ marginTop: 10 }}>
          <div className="progress"><div style={{ width: `${ag.pct}%`, background: clr }} /></div>
          <span style={{ fontWeight: 700, fontSize: 13, color: clr }}>{ag.pct}%</span>
          <span className="mut">المحقق {ag.done} من {ag.total}</span>
          {ag.late > 0 && <span className="badge b-late">{ag.late} متأخرة</span>}
          <span style={{ fontSize: 12, color: ag.gap < 0 ? "var(--red)" : "var(--teal)" }}>الفارق التراكمي: {ag.gap > 0 ? "+" : ""}{ag.gap}</span>
        </div>
      </div>
      {open && tasks.sort((a, b) => a.month_no - b.month_no).map((t) => <TaskRow key={t.id} task={t} cur={cur} {...rest} />)}
    </div>
  );
}

export default function PlanDashboard({ planId, me }) {
  const [plan, setPlan] = useState(null);
  const [members, setMembers] = useState([]);
  const [tab, setTab] = useState("board");
  const [filter, setFilter] = useState(0);
  const [changeFor, setChangeFor] = useState(null);
  const [err, setErr] = useState("");

  const load = async () => {
    const [{ data: p, error: pe }, { data: ms }] = await Promise.all([
      supabase.from("plans").select("*, indicators(*, tasks(*, assignments:task_assignments(*)))").eq("id", planId).single(),
      supabase.from("plan_members").select("*, profile:profiles(*)").eq("plan_id", planId),
    ]);
    if (pe) { setErr(pe.message); return; }
    p.indicators.sort((a, b) => a.sort_order - b.sort_order);
    setPlan(p); setMembers(ms || []);
  };
  useEffect(() => { load(); }, [planId]);

  const isManager = useMemo(() =>
    !!plan && (plan.owner_id === me.id || me.is_admin ||
      members.some((m) => m.user_id === me.id && m.role === "manager")), [plan, members, me]);

  if (err) return <div className="alert-err">⚠ {err}</div>;
  if (!plan) return <div className="mut">جارٍ التحميل…</div>;

  const cur = currentMonthOf(plan);
  const allTasks = plan.indicators.flatMap((i) => i.tasks);
  const names = Object.fromEntries(members.map((m) => [m.user_id, m.profile.name]));
  const ag = aggregates(allTasks, cur);
  const noPrimary = allTasks.filter((t) => t.status === "pending" && t.month_no <= cur && !t.assignments.some((a) => a.role === "primary")).length;

  const submitChange = async (task, type, newValue, reason) => {
    const old = type === "move_month" ? String(task.month_no) : type === "edit_desc" ? task.description : "";
    const { error } = await supabase.from("task_changes").insert({
      task_id: task.id, change_type: type, old_value: old, new_value: newValue,
      reason, requested_by: me.id,
    });
    if (error) setErr(error.message);
    setChangeFor(null); setTab("changes");
  };

  const rowProps = { me, isManager, members, names, onRefresh: load, onRequestChange: setChangeFor };

  return (
    <>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 17 }}>{plan.name}</div>
          <div className="mut">{plan.indicators.length} مؤشرات · {ag.total} مهمة · {plan.months_count} شهراً · الشهر الجاري: {cur}</div>
        </div>
        <div className="tabs">
          <button className={`tab ${tab === "board" ? "on" : ""}`} onClick={() => setTab("board")}>لوحة المتابعة</button>
          <button className={`tab ${tab === "changes" ? "on" : ""}`} onClick={() => setTab("changes")}>طلبات التغيير</button>
          <button className={`tab ${tab === "members" ? "on" : ""}`} onClick={() => setTab("members")}>الأعضاء</button>
        </div>
      </div>

      {tab === "members" && <MembersTab planId={planId} members={members} isManager={isManager} onRefresh={load} />}
      {tab === "changes" && <ChangesTab planId={planId} me={me} isManager={isManager} names={names} onApplied={load} />}
      {tab === "board" && (
        <>
          <div className="row">
            {[
              ["نسبة الإنجاز الكلية", `${ag.pct}%`, `${ag.done} من ${ag.total} مهمة`, "var(--teal)"],
              ["مهام متأخرة", ag.late, "تجاوزت شهرها دون إنجاز", ag.late ? "var(--red)" : "var(--teal)"],
              ["مستحقة هذا الشهر", ag.now, `مهام شهر ${cur}`, "var(--amber)"],
              ["بلا مسؤول رئيس", noPrimary, "مستحقة وتتطلب تعيين رئيس", noPrimary ? "var(--sand-ink)" : "var(--teal)"],
            ].map(([l, v, s, c]) => (
              <div key={l} className="card kpi">
                <div className="mut">{l}</div>
                <div className="v" style={{ color: c }}>{v}</div>
                <div className="mut" style={{ fontSize: 11, marginTop: 6 }}>{s}</div>
              </div>
            ))}
          </div>

          <div className="card">
            <div className="row" style={{ justifyContent: "space-between", marginBottom: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 13 }}>مسار أشهر الخطة</div>
              <div className="mut" style={{ fontSize: 11 }}>انقر شهراً لتصفية المهام</div>
            </div>
            <div className="row" style={{ gap: 6 }}>
              {Array.from({ length: plan.months_count }, (_, i) => i + 1).map((m) => {
                const mt = allTasks.filter((t) => t.month_no === m && t.status !== "cancelled");
                const done = mt.filter((t) => t.status === "done").length;
                let bg = "#EEF1F0", fg = "var(--mut)";
                if (mt.length) {
                  if (m < cur) { bg = done === mt.length ? "var(--teal)" : "var(--red)"; fg = "#fff"; }
                  else if (m === cur) { bg = done === mt.length ? "var(--teal)" : "var(--sand)"; fg = "#fff"; }
                  else { bg = "var(--teal-soft)"; fg = "var(--teal)"; }
                }
                return (
                  <button key={m} className="monthdot" title={`شهر ${m}: ${done}/${mt.length}`}
                    style={{ background: bg, color: fg, borderColor: bg,
                      outline: m === cur ? "2px dashed var(--sand)" : "none", outlineOffset: 2,
                      boxShadow: filter === m ? "0 0 0 3px var(--ink)" : "none" }}
                    onClick={() => setFilter(filter === m ? 0 : m)}>
                    {m}
                  </button>
                );
              })}
            </div>
          </div>

          {filter > 0 && (
            <div style={{ fontSize: 12.5, color: "var(--teal)", background: "var(--teal-soft)", borderRadius: 10, padding: "8px 14px" }}>
              تعرض المؤشرات مهام <b>شهر {filter}</b> فقط — انقر الشهر مجدداً لإلغاء التصفية.
            </div>
          )}

          {plan.indicators.map((ind) => (
            <IndicatorCard key={ind.id} ind={ind} cur={cur} filter={filter} {...rowProps} />
          ))}
        </>
      )}

      {changeFor && <ChangeModal task={changeFor} months={plan.months_count} onSubmit={submitChange} onClose={() => setChangeFor(null)} />}
    </>
  );
}

function ChangeModal({ task, months, onSubmit, onClose }) {
  const [type, setType] = useState("move_month");
  const [newMonth, setNewMonth] = useState(task.month_no);
  const [newDesc, setNewDesc] = useState(task.description);
  const [reason, setReason] = useState("");

  const submit = () => {
    if (!reason.trim()) return;
    const val = type === "move_month" ? String(newMonth) : type === "edit_desc" ? newDesc : "";
    onSubmit(task, type, val, reason.trim());
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.35)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }} onClick={onClose}>
      <div className="card" style={{ width: "100%", maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>طلب تغيير على المهمة</div>
        <div className="mut" style={{ marginBottom: 12 }}>«{task.description}» — شهر {task.month_no}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="move_month">نقل إلى شهر آخر</option>
            <option value="edit_desc">تعديل وصف المهمة</option>
            <option value="cancel">إلغاء المهمة (باعتماد المدير)</option>
          </select>
          {type === "move_month" && (
            <select className="input" value={newMonth} onChange={(e) => setNewMonth(e.target.value)}>
              {Array.from({ length: months }, (_, i) => i + 1).map((m) => <option key={m} value={m}>شهر {m}</option>)}
            </select>
          )}
          {type === "edit_desc" && <textarea className="input" rows={2} value={newDesc} onChange={(e) => setNewDesc(e.target.value)} />}
          <textarea className="input" rows={2} placeholder="سبب الطلب (إلزامي — يُحفظ في سجل التغييرات)" value={reason} onChange={(e) => setReason(e.target.value)} />
          <div className="row">
            <button className="btn btn-primary" disabled={!reason.trim()} onClick={submit}>إرسال الطلب</button>
            <button className="btn btn-ghost" onClick={onClose}>إلغاء</button>
          </div>
        </div>
      </div>
    </div>
  );
}
