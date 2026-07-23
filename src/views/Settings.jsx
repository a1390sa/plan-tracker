import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase.js";

export default function Settings({ me, onProfileChange }) {
  const [name, setName] = useState(me?.name || "");
  const [pass1, setPass1] = useState("");
  const [pass2, setPass2] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [users, setUsers] = useState(null);
  const [busy, setBusy] = useState(false);

  const loadUsers = async () => {
    if (!me?.is_admin) return;
    const { data, error } = await supabase.from("profiles").select("*").order("name");
    if (error) setErr(error.message); else setUsers(data || []);
  };
  useEffect(() => { loadUsers(); }, [me?.is_admin]);

  const saveName = async () => {
    setMsg(""); setErr("");
    if (!name.trim()) { setErr("الاسم لا يمكن أن يكون فارغاً."); return; }
    const { error } = await supabase.from("profiles").update({ name: name.trim() }).eq("id", me.id);
    if (error) setErr(error.message);
    else { setMsg("حُفظ الاسم بنجاح."); onProfileChange?.(); }
  };

  const changePassword = async () => {
    setMsg(""); setErr("");
    if (pass1.length < 6) { setErr("كلمة المرور يجب ألا تقل عن 6 أحرف."); return; }
    if (pass1 !== pass2) { setErr("الحقلان غير متطابقين."); return; }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pass1 });
    setBusy(false);
    if (error) setErr(error.message);
    else { setMsg("تم تغيير كلمة المرور بنجاح."); setPass1(""); setPass2(""); }
  };

  const sendReset = async (email) => {
    setMsg(""); setErr("");
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
    if (error) setErr(error.message);
    else setMsg(`أُرسل رابط استعادة كلمة المرور إلى ${email} — صالح لمدة ساعة، وقد يصل إلى مجلد البريد غير المرغوب.`);
  };

  const toggleAdmin = async (u) => {
    setMsg(""); setErr("");
    const admins = (users || []).filter((x) => x.is_admin).length;
    if (u.is_admin && admins <= 1) { setErr("لا يمكن نزع صفة مدير النظام من آخر مدير — رقِّ غيره أولاً."); return; }
    if (u.id === me.id && u.is_admin && !window.confirm("ستنزع صفة مدير النظام عن نفسك وتفقد الصلاحيات فوراً. هل أنت متأكد؟")) return;
    const { error } = await supabase.from("profiles").update({ is_admin: !u.is_admin }).eq("id", u.id);
    if (error) setErr(error.message.includes("row-level security") ? "الصلاحية مرفوضة — نفّذ مقطع SQL الخاص بصلاحية المديرين." : error.message);
    else { await loadUsers(); onProfileChange?.(); setMsg(u.is_admin ? `نُزعت صفة مدير النظام عن ${u.name}.` : `صار ${u.name} مدير نظام.`); }
  };

  return (
    <>
      {msg && <div className="alert-warn">{msg}</div>}
      {err && <div className="alert-err">⚠ {err}</div>}

      <div className="card">
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>ملفي الشخصي</div>
        <div className="mut" style={{ marginBottom: 12 }}>
          اسم الدخول (اسم المستخدم) هو بريدك: <b dir="ltr" style={{ color: "var(--ink)" }}>{me?.email}</b>
        </div>
        <div className="row">
          <label className="mut" style={{ minWidth: 90 }}>الاسم الظاهر:</label>
          <input className="input grow" value={name} onChange={(e) => setName(e.target.value)} />
          <button className="btn btn-primary" onClick={saveName}>حفظ</button>
        </div>
      </div>

      <div className="card">
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>تغيير كلمة المرور</div>
        <div className="mut" style={{ marginBottom: 12 }}>اكتب كلمة المرور الجديدة مرتين (6 أحرف فأكثر)</div>
        <div className="row">
          <input className="input grow" dir="ltr" type="password" placeholder="كلمة المرور الجديدة" value={pass1} onChange={(e) => setPass1(e.target.value)} />
          <input className="input grow" dir="ltr" type="password" placeholder="تأكيد كلمة المرور" value={pass2} onChange={(e) => setPass2(e.target.value)} />
          <button className="btn btn-primary" disabled={busy} onClick={changePassword}>{busy ? "لحظة…" : "تغيير"}</button>
        </div>
      </div>

      {me?.is_admin && (
        <div className="card" style={{ padding: 0, overflow: "auto" }}>
          <div style={{ padding: "16px 18px 10px" }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>إدارة المستخدمين</div>
            <div className="mut">ترقية المديرين، ومعرفة أسماء الدخول، وإرسال روابط استعادة كلمة المرور</div>
          </div>
          <table className="tbl">
            <thead><tr><th>الاسم</th><th>اسم الدخول (البريد)</th><th>مدير النظام</th><th>استعادة كلمة المرور</th></tr></thead>
            <tbody>
              {(users || []).map((u) => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 700 }}>{u.name}{u.id === me.id && <span className="mut"> (أنت)</span>}</td>
                  <td dir="ltr" className="mut">{u.email}</td>
                  <td>
                    <button className={`chip ${u.is_admin ? "on" : ""}`} onClick={() => toggleAdmin(u)}>
                      {u.is_admin ? "✓ مدير نظام" : "＋ ترقية"}
                    </button>
                  </td>
                  <td>
                    <button className="btn btn-ghost" style={{ fontSize: 12, padding: "5px 10px" }} onClick={() => sendReset(u.email)}>
                      إرسال رابط
                    </button>
                  </td>
                </tr>
              ))}
              {users === null && <tr><td colSpan={4} className="mut">جارٍ التحميل…</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
