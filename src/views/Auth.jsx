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
      if (mode === "signup") {
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

  return (
    <div className="center-page">
      <div className="card" style={{ width: "100%", maxWidth: 420 }}>
        <div style={{ textAlign: "center", marginBottom: 18 }}>
          <div style={{ width: 54, height: 54, borderRadius: 16, background: "var(--teal)", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 26, fontWeight: 700 }}>خ</div>
          <h1 style={{ fontSize: 20, margin: "12px 0 4px" }}>نظام متابعة تنفيذ الخطط</h1>
          <div className="mut">{mode === "login" ? "سجّل الدخول للمتابعة" : "إنشاء حساب جديد"}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {mode === "signup" && <input className="input" placeholder="الاسم الكامل" value={name} onChange={(e) => setName(e.target.value)} />}
          <input className="input" dir="ltr" placeholder="البريد الإلكتروني" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className="input" dir="ltr" type="password" placeholder="كلمة المرور" value={pass} onChange={(e) => setPass(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} />
          <button className="btn btn-primary" disabled={busy} onClick={submit}>
            {busy ? "لحظة…" : mode === "login" ? "تسجيل الدخول" : "إنشاء الحساب"}
          </button>
          {msg && <div className="alert-warn">{msg}</div>}
          <button className="btn btn-ghost" onClick={() => { setMode(mode === "login" ? "signup" : "login"); setMsg(""); }}>
            {mode === "login" ? "لا تملك حساباً؟ أنشئ حساباً" : "لديك حساب؟ سجّل الدخول"}
          </button>
        </div>
      </div>
    </div>
  );
}
