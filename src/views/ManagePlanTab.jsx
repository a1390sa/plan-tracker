import React, { useState } from "react";
import { supabase } from "../lib/supabase.js";

function TaskEditRow({ task, monthsCount, onUpdate, onDelete }) {
  const [desc, setDesc] = useState(task.description);
  const [month, setMonth] = useState(task.month_no);
  const dirty = desc !== task.description || Number(month) !== task.month_no;

  return (
    <div className="row" style={{ padding: "6px 0", borderTop: "1px solid var(--line)" }}>
      <select className="input" style={{ width: 90 }} value={month} onChange={(e) => setMonth(e.target.value)}>
        {Array.from({ length: monthsCount }, (_, i) => i + 1).map((m) => <option key={m} value={m}>شهر {m}</option>)}
      </select>
      <input className="input grow" value={desc} onChange={(e) => setDesc(e.target.value)} />
      {dirty && (
        <button className="btn btn-primary" style={{ padding: "5px 10px", fontSize: 12 }}
          onClick={() => onUpdate({ description: desc.trim(), month_no: Number(month) })}>حفظ</button>
      )}
      <button className="btn btn-ghost" style={{ color: "var(--red)", padding: "5px 10px", fontSize: 12 }} onClick={onDelete}>حذف</button>
    </div>
  );
}

function IndicatorCard({ indicator, monthsCount, onRefresh }) {
  const [name, setName] = useState(indicator.name);
  const [target, setTarget] = useState(indicator.total_target);
  const [newTaskMonth, setNewTaskMonth] = useState(1);
  const [newTaskDesc, setNewTaskDesc] = useState("");
  const dirty = name !== indicator.name || Number(target) !== indicator.total_target;

  const save = async () => {
    await supabase.from("indicators").update({ name: name.trim(), total_target: Number(target) || 0 }).eq("id", indicator.id);
    onRefresh();
  };

  const removeIndicator = async () => {
    const sure = window.confirm(
      `تحذير: سيُحذف المؤشر «${indicator.name}» نهائياً مع كل مهامه (${indicator.tasks.length}) وإسناداته — ولا يمكن التراجع.\n\nهل أنت متأكد؟`
    );
    if (!sure) return;
    await supabase.from("indicators").delete().eq("id", indicator.id);
    onRefresh();
  };

  const updateTask = async (taskId, patch) => {
    await supabase.from("tasks").update(patch).eq("id", taskId);
    onRefresh();
  };

  const removeTask = async (taskId, desc) => {
    if (!window.confirm(`حذف المهمة «${desc}» نهائياً؟ لا يمكن التراجع.`)) return;
    await supabase.from("tasks").delete().eq("id", taskId);
    onRefresh();
  };

  const addTask = async () => {
    if (!newTaskDesc.trim()) return;
    await supabase.from("tasks").insert({
      indicator_id: indicator.id, month_no: Number(newTaskMonth),
      description: newTaskDesc.trim(), status: "pending", task_kind: "basic",
    });
    setNewTaskDesc("");
    onRefresh();
  };

  return (
    <div className="card">
      <div className="row">
        <input className="input grow" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="input" style={{ width: 110 }} type="number" value={target} onChange={(e) => setTarget(e.target.value)} />
        {dirty && <button className="btn btn-primary" onClick={save}>حفظ</button>}
        <button className="btn btn-ghost" style={{ color: "var(--red)" }} onClick={removeIndicator}>حذف المؤشر</button>
      </div>

      <div style={{ marginTop: 10 }}>
        {indicator.tasks.slice().sort((a, b) => a.month_no - b.month_no).map((t) => (
          <TaskEditRow key={t.id} task={t} monthsCount={monthsCount}
            onUpdate={(patch) => updateTask(t.id, patch)} onDelete={() => removeTask(t.id, t.description)} />
        ))}
        {!indicator.tasks.length && <div className="mut" style={{ padding: "8px 0" }}>لا توجد مهام بعد.</div>}
      </div>

      <div className="row" style={{ marginTop: 10, borderTop: "1px dashed var(--line)", paddingTop: 10 }}>
        <select className="input" style={{ width: 90 }} value={newTaskMonth} onChange={(e) => setNewTaskMonth(e.target.value)}>
          {Array.from({ length: monthsCount }, (_, i) => i + 1).map((m) => <option key={m} value={m}>شهر {m}</option>)}
        </select>
        <input className="input grow" placeholder="وصف مهمة جديدة" value={newTaskDesc} onChange={(e) => setNewTaskDesc(e.target.value)} />
        <button className="btn btn-primary" onClick={addTask}>+ إضافة مهمة</button>
      </div>
    </div>
  );
}

export default function ManagePlanTab({ plan, onRefresh }) {
  const [planName, setPlanName] = useState(plan.name);
  const [newIndName, setNewIndName] = useState("");
  const [newIndTarget, setNewIndTarget] = useState(0);

  const savePlanName = async () => {
    if (!planName.trim()) return;
    await supabase.from("plans").update({ name: planName.trim() }).eq("id", plan.id);
    onRefresh();
  };

  const addIndicator = async () => {
    if (!newIndName.trim()) return;
    await supabase.from("indicators").insert({
      plan_id: plan.id, name: newIndName.trim(),
      total_target: Number(newIndTarget) || 0, sort_order: plan.indicators.length,
    });
    setNewIndName(""); setNewIndTarget(0);
    onRefresh();
  };

  return (
    <>
      <div className="card">
        <div style={{ fontWeight: 700, marginBottom: 10 }}>معلومات الخطة</div>
        <div className="row">
          <label className="mut">اسم الخطة:</label>
          <input className="input grow" value={planName} onChange={(e) => setPlanName(e.target.value)} />
          {planName.trim() !== plan.name && (
            <button className="btn btn-primary" disabled={!planName.trim()} onClick={savePlanName}>حفظ</button>
          )}
        </div>
      </div>

      <div className="card">
        <div style={{ fontWeight: 700, marginBottom: 10 }}>إضافة مؤشر جديد</div>
        <div className="row">
          <input className="input grow" placeholder="اسم المؤشر" value={newIndName} onChange={(e) => setNewIndName(e.target.value)} />
          <input className="input" style={{ width: 130 }} type="number" placeholder="المستهدف الكلي" value={newIndTarget} onChange={(e) => setNewIndTarget(e.target.value)} />
          <button className="btn btn-primary" disabled={!newIndName.trim()} onClick={addIndicator}>+ إضافة</button>
        </div>
      </div>

      {plan.indicators.slice().sort((a, b) => a.sort_order - b.sort_order).map((ind) => (
        <IndicatorCard key={ind.id} indicator={ind} monthsCount={plan.months_count} onRefresh={onRefresh} />
      ))}
      {!plan.indicators.length && (
        <div className="card mut" style={{ textAlign: "center" }}>لا توجد مؤشرات بعد — أضف أول مؤشر أعلاه.</div>
      )}
    </>
  );
}
