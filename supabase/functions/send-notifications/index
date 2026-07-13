// وظيفة التنبيهات اليومية — تُجدول لتعمل 6 صباحاً بتوقيت الرياض (03:00 UTC)
// تطبّق قواعد الفصل السابع من وثيقة المتطلبات 1.2:
// تذكير استباقي (بداية/منتصف الشهر) · إنذار قبل النهاية بـ3 أيام ·
// إشعار تأخر · تصعيد كل 3 أيام (الرئيس، وبعد أسبوعين المدير) · ملخص أسبوعي (الأحد)
// التجميع: رسالة واحدة لكل مستلم يومياً.

import { createClient } from "npm:@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);
const RESEND_KEY = Deno.env.get("RESEND_API_KEY")!;
const FROM = Deno.env.get("MAIL_FROM") ?? "onboarding@resend.dev";
const APP_URL = Deno.env.get("APP_URL") ?? "";

type Line = { kind: string; text: string; taskId: string | null };

function currentMonthOf(plan: any, d: Date) {
  const idx = (d.getUTCFullYear() - plan.start_year) * 12 + (d.getUTCMonth() + 1) - plan.start_month + 1;
  return Math.min(Math.max(idx, 1), plan.months_count);
}

Deno.serve(async () => {
  const now = new Date();
  const day = now.getUTCDate();
  const isSunday = now.getUTCDay() === 0;
  const daysInMonth = new Date(now.getUTCFullYear(), now.getUTCMonth() + 1, 0).getDate();
  const nearEnd = daysInMonth - day === 3;

  const { data: plans, error } = await supabase.from("plans").select(`
    id, name, start_year, start_month, months_count, owner_id,
    members:plan_members(user_id, role, profile:profiles(id, name, email)),
    indicators(id, name, tasks(id, description, month_no, status,
      assignments:task_assignments(user_id, role)))
  `);
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  // مستلم → سطور تنبيهاته اليوم
  const inbox = new Map<string, { email: string; name: string; lines: Line[] }>();
  const push = (p: { id: string; email: string; name: string }, l: Line) => {
    if (!inbox.has(p.id)) inbox.set(p.id, { email: p.email, name: p.name, lines: [] });
    inbox.get(p.id)!.lines.push(l);
  };

  // آخر إرسال لكل (مستلم، مهمة، نوع) لضبط التكرار
  const since = new Date(now.getTime() - 40 * 24 * 3600 * 1000).toISOString();
  const { data: sent } = await supabase.from("notifications").select("recipient, task_id, kind, sent_at").gte("sent_at", since);
  const lastSent = (rec: string, task: string | null, kind: string) => {
    const hits = (sent ?? []).filter((n) => n.recipient === rec && n.task_id === task && n.kind === kind);
    return hits.length ? new Date(Math.max(...hits.map((h) => +new Date(h.sent_at)))) : null;
  };
  const daysAgo = (d: Date | null) => d === null ? Infinity : (now.getTime() - d.getTime()) / 86400000;

  for (const plan of plans ?? []) {
    const cur = currentMonthOf(plan, now);
    const profs: Record<string, any> = {};
    for (const m of plan.members ?? []) profs[m.user_id] = m.profile;
    const managers = (plan.members ?? []).filter((m: any) => m.role === "manager").map((m: any) => m.profile);

    const planLate: string[] = [];
    const planUnassigned: string[] = [];

    for (const ind of plan.indicators ?? []) {
      for (const t of ind.tasks ?? []) {
        if (t.status === "done" || t.status === "cancelled") continue;
        const primary = (t.assignments ?? []).find((a: any) => a.role === "primary");
        const supports = (t.assignments ?? []).filter((a: any) => a.role === "support");
        const pProf = primary ? profs[primary.user_id] : null;
        const label = `«${t.description}» (${ind.name} — شهر ${t.month_no})`;

        if (!primary) { if (t.month_no <= cur) planUnassigned.push(label); continue; }

        if (t.month_no === cur) {
          // تذكير استباقي: بداية الشهر ومنتصفه — للرئيس والمساندين
          if (day <= 2 || (day >= 14 && day <= 15)) {
            const k = day <= 2 ? "reminder_start" : "reminder_mid";
            for (const a of [primary, ...supports]) {
              const pr = profs[a.user_id]; if (!pr) continue;
              if (daysAgo(lastSent(pr.id, t.id, k)) > 5) push(pr, { kind: k, text: `تذكير: ${label} مستحقة هذا الشهر.`, taskId: t.id });
            }
          }
          // إنذار اقتراب الاستحقاق — للرئيس فقط
          if (nearEnd && pProf && daysAgo(lastSent(pProf.id, t.id, "due_soon")) > 5)
            push(pProf, { kind: "due_soon", text: `إنذار: ${label} — بقيت 3 أيام على نهاية الشهر.`, taskId: t.id });
        }

        if (t.month_no < cur) {
          planLate.push(label);
          const firstLate = lastSent(pProf?.id ?? "", t.id, "late");
          if (pProf && firstLate === null) {
            // إشعار التأخر الأول: الرئيس والمدير، ونسخة للمساندين
            push(pProf, { kind: "late", text: `تأخر: ${label} تجاوزت شهرها دون إنجاز.`, taskId: t.id });
            for (const mg of managers) if (mg.id !== pProf.id) push(mg, { kind: "late_mgr", text: `تأخر لدى ${pProf.name}: ${label}.`, taskId: t.id });
            for (const s of supports) { const sp = profs[s.user_id]; if (sp) push(sp, { kind: "late_copy", text: `للعلم — تأخر: ${label}.`, taskId: t.id }); }
          } else if (pProf && daysAgo(lastSent(pProf.id, t.id, "escalation")) >= 3) {
            // تصعيد كل 3 أيام للرئيس، وبعد أسبوعين من أول تأخر يُضاف المدير
            push(pProf, { kind: "escalation", text: `تصعيد: ${label} لا تزال متأخرة — حدّث حالتها أو قدّم طلب تغيير.`, taskId: t.id });
            if (daysAgo(firstLate) >= 14)
              for (const mg of managers) if (mg.id !== pProf.id) push(mg, { kind: "escalation_mgr", text: `تصعيد مستمر: ${label} متأخرة لدى ${pProf.name} منذ أكثر من أسبوعين.`, taskId: t.id });
          }
        }
      }
    }

    // الملخص الأسبوعي للمديرين (الأحد)
    if (isSunday) {
      const all = (plan.indicators ?? []).flatMap((i: any) => i.tasks ?? []).filter((t: any) => t.status !== "cancelled");
      const done = all.filter((t: any) => t.status === "done").length;
      const pct = all.length ? Math.round((done / all.length) * 100) : 0;
      const summary = `ملخص «${plan.name}»: الإنجاز ${pct}% (${done}/${all.length}) · متأخرة: ${planLate.length} · بلا مسؤول رئيس: ${planUnassigned.length}.`;
      for (const mg of managers)
        if (daysAgo(lastSent(mg.id, null, "weekly")) > 5)
          push(mg, { kind: "weekly", text: summary, taskId: null });
    }
  }

  // الإرسال المجمّع: رسالة واحدة لكل مستلم
  let sentCount = 0;
  for (const [uid, box] of inbox) {
    if (!box.lines.length || !box.email) continue;
    const html = `<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;font-size:14px;line-height:1.9;color:#22302C">
      <p>السلام عليكم ${box.name}،</p>
      <p>تنبيهات نظام متابعة الخطط لهذا اليوم:</p>
      <ul>${box.lines.map((l) => `<li>${l.text}</li>`).join("")}</ul>
      ${APP_URL ? `<p><a href="${APP_URL}">فتح النظام</a></p>` : ""}
      <p style="color:#6B7A75;font-size:12px">رسالة آلية — لا تردّ عليها.</p></div>`;
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: box.email, subject: "تنبيهات متابعة الخطط اليوم", html }),
    });
    if (res.ok) {
      sentCount++;
      await supabase.from("notifications").insert(
        box.lines.map((l) => ({ task_id: l.taskId, recipient: uid, kind: l.kind })),
      );
    }
  }

  return new Response(JSON.stringify({ ok: true, emails_sent: sentCount }), {
    headers: { "Content-Type": "application/json" },
  });
});
