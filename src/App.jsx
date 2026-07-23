import React, { useEffect, useState } from "react";
import { supabase } from "./lib/supabase.js";
import Auth, { ResetPassword } from "./views/Auth.jsx";
import PlansList from "./views/PlansList.jsx";
import PlanDashboard from "./views/PlanDashboard.jsx";
import Analytics from "./views/Analytics.jsx";
import Settings from "./views/Settings.jsx";

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = جارٍ التحقق
  const [profile, setProfile] = useState(null);
  const [openPlan, setOpenPlan] = useState(null);
  const [view, setView] = useState("plans"); // plans | analytics | settings
  const [recovery, setRecovery] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) { setProfile(null); return; }
    supabase.from("profiles").select("*").eq("id", session.user.id).single()
      .then(({ data }) => setProfile(data ?? { id: session.user.id, name: session.user.email, email: session.user.email, is_admin: false }));
  }, [session, reload]);

  if (session === undefined) return <div className="center-page mut">جارٍ التحميل…</div>;
  if (recovery && session) return <ResetPassword onDone={() => setRecovery(false)} />;
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
          {openPlan ? (
            <button className="btn btn-ghost" onClick={() => setOpenPlan(null)}>← كل الخطط</button>
          ) : (
            <div className="tabs">
              <button className={`tab ${view === "plans" ? "on" : ""}`} onClick={() => setView("plans")}>خططي</button>
              <button className={`tab ${view === "analytics" ? "on" : ""}`} onClick={() => setView("analytics")}>لوحة التحكم</button>
              <button className={`tab ${view === "settings" ? "on" : ""}`} onClick={() => setView("settings")}>الإعدادات</button>
            </div>
          )}
          <button className="btn btn-ghost" onClick={() => supabase.auth.signOut()}>تسجيل الخروج</button>
        </div>
      </div>

      {openPlan
        ? <PlanDashboard planId={openPlan} me={profile} onBack={() => setOpenPlan(null)} />
        : view === "analytics"
          ? <Analytics me={profile} />
          : view === "settings"
            ? <Settings me={profile} onProfileChange={() => setReload((n) => n + 1)} />
            : <PlansList me={profile} onOpen={setOpenPlan} />}
    </div>
  );
}
