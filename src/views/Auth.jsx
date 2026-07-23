import React, { useState } from "react";
import { supabase } from "../lib/supabase.js";

export default function Auth() {
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setMsg(""); setBusy(true);
    try {
      if (mode === "forgot") {
        if (!email.trim()) throw new Error("اكتب بريدك الإلكتروني أولاً.");
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin });
        if (error) throw error;
        setMsg("أُرسل رابط استعادة كلمة المرور إلى بريدك — افحص صندوق الوارد ومجلد البريد غير المرغوب. الرابط صالح لمدة ساعة.");
      } else if (mode === "signup") {
        if (!name.trim()) throw new Error("اكتب الاسم الكامل.");
        const { error } = await supabase.auth.signUp({
          email, password: pass, options: { data: { name: name.trim() } },
        });
        if (error) throw error;
        setMsg("تم إنشاء الحساب. إن كان تأكيد البريد مفعّلاً فافحص بريدك، وإلا فسجّل الدخول مباشرة.");
        setMode("login");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
        if (error) throw error;
      }
    } catch (e) {
      setMsg(e.message === "Invalid login credentials" ? "بيانات الدخول غير صحيحة." : e.message);
    } finally { setBusy(false); }
  };

  const title = mode === "login" ? "سجّل الدخول للمتابعة" : mode === "signup" ? "إنشاء حساب جديد" : "استعادة كلمة المرور";

  return (
    <div className="center-page">
      <div className="card" style={{ width: "100%", maxWidth: 420 }}>
        <div style={{ textAlign: "center", marginBottom: 18 }}>
          <div style={{ width: 54, height: 54, borderRadius: 16, background: "var(--teal)", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 26, fontWeight: 700 }}>خ</div>
          <h1 style={{ fontSize: 20, margin: "12px 0 4px" }}>نظام متابعة تنفيذ الخطط</h1>
          <div className="mut">{title}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {mode === "signup" && <input className="input" placeholder="الاسم الكامل" value={name} onChange={(e) => setName(e.target.value)} />}
          <input className="input" dir="ltr" placeholder="البريد الإلكتروني" value={email} onChange={(e) => setEmail(e.target.value)} />
          {mode !== "forgot" && (
            <input className="input" dir="ltr" type="password" placeholder="كلمة المرور" value={pass} onChange={(e) => setPass(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} />
          )}
          <button className="btn btn-primary" disabled={busy} onClick={submit}>
            {busy ? "لحظة…" : mode === "login" ? "تسجيل الدخول" : mode === "signup" ? "إنشاء الحساب" : "إرسال رابط الاستعادة"}
          </button>
          {msg && <div className="alert-warn">{msg}</div>}
          {mode === "login" && (
            <button className="btn btn-ghost" onClick={() => { setMode("forgot"); setMsg(""); }}>نسيت كلمة المرور؟</button>
          )}
          <button className="btn btn-ghost" onClick={() => { setMode(mode === "login" ? "signup" : "login"); setMsg(""); }}>
            {mode === "login" ? "لا تملك حساباً؟ أنشئ حساباً" : "لديك حساب؟ سجّل الدخول"}
          </button>
        </div>
      </div>
    </div>
  );
}

// شاشة تعيين كلمة مرور جديدة — تظهر عند الدخول من رابط الاستعادة
export function ResetPassword({ onDone }) {
  const [pass1, setPass1] = useState("");
  const [pass2, setPass2] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setMsg("");
    if (pass1.length < 6) { setMsg("كلمة المرور يجب ألا تقل عن 6 أحرف."); return; }
    if (pass1 !== pass2) { setMsg("الحقلان غير متطابقين."); return; }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pass1 });
    setBusy(false);
    if (error) setMsg(error.message);
    else onDone();
  };

  return (
    <div className="center-page">
      <div className="card" style={{ width: "100%", maxWidth: 420 }}>
        <div style={{ textAlign: "center", marginBottom: 18 }}>
          <div style={{ width: 54, height: 54, borderRadius: 16, background: "var(--teal)", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 26, fontWeight: 700 }}>خ</div>
          <h1 style={{ fontSize: 20, margin: "12px 0 4px" }}>تعيين كلمة مرور جديدة</h1>
          <div className="mut">اكتب كلمة المرور الجديدة مرتين للتأكيد</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <input className="input" dir="ltr" type="password" placeholder="كلمة المرور الجديدة" value={pass1} onChange={(e) => setPass1(e.target.value)} />
          <input className="input" dir="ltr" type="password" placeholder="تأكيد كلمة المرور" value={pass2} onChange={(e) => setPass2(e.target.value)} onKeyDown={(e) => e.key === "Enter" && save()} />
          <button className="btn btn-primary" disabled={busy} onClick={save}>{busy ? "لحظة…" : "حفظ والدخول"}</button>
          {msg && <div className="alert-warn">{msg}</div>}
        </div>
      </div>
    </div>
  );
}
