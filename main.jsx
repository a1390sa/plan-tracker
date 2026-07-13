import React, { useState } from "react";
import { supabase } from "../lib/supabase.js";

const ROLE_AR = { manager: "مدير الخطة", executor: "منفّذ", viewer: "مشاهد" };

export default function MembersTab({ planId, members, isManager, onRefresh }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("executor");
  const [msg, setMsg] = useState("");

  const add = async () => {
    setMsg("");
    const { data: prof } = await supabase.from("profiles").select("id, name").eq("email", email.trim().toLowerCase()).maybeSingle();
    if (!prof) { setMsg("لا يوجد مستخدم بهذا البريد — اطلب منه إنشاء حساب أولاً ثم أضفه."); return; }
    const { error } = await supabase.from("plan_members").upsert({ plan_id: planId, user_id: prof.id, role });
    if (error) { setMsg(error.message); return; }
    setEmail(""); onRefresh();
  };

  const remove = async (uid) => {
    await supabase.from("plan_members").delete().eq("plan_id", planId).eq("user_id", uid);
    onRefresh();
  };

  return (
    <>
      {isManager && (
        <div className="card">
          <div style={{ fontWeight: 700, marginBottom: 10 }}>إضافة عضو إلى فريق الخطة</div>
          <div className="row">
            <input className="input grow" dir="ltr" placeholder="البريد الإلكتروني للموظف" value={email} onChange={(e) => setEmail(e.target.value)} />
            <select className="input" style={{ width: "auto" }} value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="executor">منفّذ</option>
              <option value="manager">مدير الخطة</option>
              <option value="viewer">مشاهد</option>
            </select>
            <button className="btn btn-primary" onClick={add}>إضافة</button>
          </div>
          {msg && <div className="alert-warn" style={{ marginTop: 10 }}>{msg}</div>}
        </div>
      )}
      <div className="card" style={{ padding: 0, overflow: "auto" }}>
        <table className="tbl">
          <thead><tr><th>الاسم</th><th>البريد</th><th>الدور</th><th></th></tr></thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.user_id}>
                <td style={{ fontWeight: 700 }}>{m.profile.name}</td>
                <td dir="ltr" className="mut">{m.profile.email}</td>
                <td><span className="badge b-done">{ROLE_AR[m.role]}</span></td>
                <td>{isManager && <button className="btn btn-ghost" style={{ color: "var(--red)", fontSize: 12 }} onClick={() => remove(m.user_id)}>إزالة</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
