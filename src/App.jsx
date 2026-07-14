import React, { useEffect, useState } from "react";
import { supabase } from "./lib/supabase.js";
import Auth from "./views/Auth.jsx";
import PlansList from "./views/PlansList.jsx";
import PlanDashboard from "./views/PlanDashboard.jsx";

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = جارٍ التحقق
  const [profile, setProfile] = useState(null);
  const [openPlan, setOpenPlan] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) { setProfile(null); return; }
    supabase.from("profiles").select("*").eq("id", session.user.id).single()
    .then(({ data }) => setProfile(data ?? { id: session.user.id, name: session.user.email, email: session.user.email, is_admin: false }));
  }, [session]);

  if (session === undefined) return <div className="center-page mut">جارٍ التحميل…</div>;
  if (!session) return <Auth />;

  return (
    <div className="container">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div className="row" style={{ gap: 12 }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: "var(--teal)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 700 }}>خ</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>نظام متابعة تنفيذ الخطط</div>
            <div className="mut">{profile?.name || session.user.email}{profile?.is_admin ? " · مدير النظام" : ""}</div>
          </div>
        </div>
        <div className="row">
          {openPlan && <button className="btn btn-ghost" onClick={() => setOpenPlan(null)}>← كل الخطط</button>}
          <button className="btn btn-ghost" onClick={() => supabase.auth.signOut()}>تسجيل الخروج</button>
        </div>
      </div>

      {openPlan
        ? <PlanDashboard planId={openPlan} me={profile} onBack={() => setOpenPlan(null)} />
        : <PlansList me={profile} onOpen={setOpenPlan} />}
    </div>
  );
}
