import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase.js";
import { currentMonthOf, taskState, aggregates } from "../lib/compute.js";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";

const TEAL = "#0E5E4E", TEALMID = "#2E8B76", SAND = "#C9A15C",
      RED = "#B3402F", AMBER = "#B37E17", GRAY = "#B9C4C0", LIGHT = "#DCE5E2";

export default function Analytics({ me }) {
  const [plans, setPlans] = useState(null);
  const [sel, setSel] = useState("all");
  const [err, setErr] = useState("");

  useEffect(() => {
    supabase.from("plans")
      .select("*, indicators(id, name, sort_order, tasks(id, month_no, status))")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => { if (error) setErr(error.message); setPlans(data || []); });
  }, []);

  const view = useMemo(() => {
    if (!plans) return null;
    const chosen = sel === "all" ? plans : plans.filter((p) => p.id === sel);
    if (!chosen.length) return null;

    // مهام كل خطة مع شهرها الجاري الخاص
    const perPlan = chosen.map((p) => {
      const tasks = (p.indicators || []).flatMap((i) => i.tasks || []);
      const cur = currentMonthOf(p);
      return { p, tasks, cur, ag: aggregates(tasks, cur) };
    });

    const allTasks = perPlan.flatMap((x) => x.tasks.map((t) => ({ ...t, _cur: x.cur })));
    const totals = {
      plans: chosen.length,
      total: allTasks.filter((t) => t.status !== "cancelled").length,
      done: allTasks.filter((t) => t.status === "done").length,
      late: allTasks.filter((t) => taskState(t, t._cur) === "late").length,
      now: allTasks.filter((t) => taskState(t, t._cur) === "now").length,
    };
    totals.pct = totals.total ? Math.round((totals.done / totals.total) * 100) : 0;

    // منحنى التراكمي: مستهدف مقابل محقق لكل شهر
    const maxM = Math.max(...chosen.map((p) => p.months_count));
    const line = [];
    for (let m = 1; m <= maxM; m++) {
      const planned = allTasks.filter((t) => t.status !== "cancelled" && t.month_no <= m).length;
      const actual = allTasks.filter((t) => t.status === "done" && t.month_no <= m).length;
      line.push({ month: m, "المستهدف التراكمي": planned, "المحقق التراكمي": actual });
    }

    // أعمدة الإنجاز: حسب المؤشر (خطة واحدة) أو حسب الخطة (الجميع)
    let bars;
    if (sel === "all") {
      bars = perPlan.map(({ p, ag }) => ({
        name: p.name.length > 28 ? p.name.slice(0, 28) + "…" : p.name,
        "نسبة الإنجاز": ag.pct, late: ag.late,
      }));
    } else {
      const { p, cur } = perPlan[0];
      bars = (p.indicators || [])
        .slice().sort((a, b) => a.sort_order - b.sort_order)
        .map((i) => {
          const ag = aggregates(i.tasks || [], cur);
          return {
            name: i.name.length > 28 ? i.name.slice(0, 28) + "…" : i.name,
            "نسبة الإنجاز": ag.pct, late: ag.late,
          };
        });
    }

    // دائرة توزيع الحالات
    const states = { done: 0, late: 0, now: 0, future: 0, cancelled: 0 };
    for (const t of allTasks) states[taskState(t, t._cur)]++;
    const pie = [
      { name: "منجزة", value: states.done, color: TEAL },
      { name: "متأخرة", value: states.late, color: RED },
      { name: "الشهر الجاري", value: states.now, color: AMBER },
      { name: "قادمة", value: states.future, color: GRAY },
      { name: "ملغاة", value: states.cancelled, color: LIGHT },
    ].filter((s) => s.value > 0);

    return { totals, line, bars, pie };
  }, [plans, sel]);

  if (err) return <div className="alert-err">⚠ {err}</div>;
  if (plans === null) return <div className="mut">جارٍ التحميل…</div>;
  if (!plans.length) return <div className="card" style={{ textAlign: "center", color: "var(--mut)" }}>لا توجد خطط بعد — ارفع خطة أولاً ثم عد للوحة التحكم.</div>;

  const { totals, line, bars, pie } = view;

  return (
    <>
      <div className="card row" style={{ justifyContent: "space-between" }}>
        <div style={{ fontWeight: 700, fontSize: 15 }}>لوحة التحكم</div>
        <div className="row">
          <label className="mut">النطاق:</label>
          <select className="input" style={{ width: "auto", fontWeight: 700 }} value={sel} onChange={(e) => setSel(e.target.value)}>
            <option value="all">جميع الخطط ({plans.length})</option>
            {plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      </div>

      <div className="row">
        {[
          ["نسبة الإنجاز", `${totals.pct}%`, sel === "all" ? `عبر ${totals.plans} خطط` : "للخطة المختارة", TEAL],
          ["المهام", totals.total, `المحقق منها ${totals.done}`, TEALMID],
          ["متأخرة", totals.late, "تجاوزت شهرها دون إنجاز", totals.late ? RED : TEAL],
          ["مستحقة هذا الشهر", totals.now, "في شهرها الجاري الآن", AMBER],
        ].map(([l, v, s, c]) => (
          <div key={l} className="card kpi">
            <div className="mut">{l}</div>
            <div className="v" style={{ color: c }}>{v}</div>
            <div className="mut" style={{ fontSize: 11, marginTop: 6 }}>{s}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>المسار التراكمي: المستهدف مقابل المحقق</div>
        <div className="mut" style={{ marginBottom: 10 }}>كل نقطة = مجموع المهام حتى ذلك الشهر — انفراج الخطين يعني تراكماً</div>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={line} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={LIGHT} />
            <XAxis dataKey="month" tickFormatter={(m) => `ش${m}`} fontSize={11} />
            <YAxis fontSize={11} allowDecimals={false} />
            <Tooltip labelFormatter={(m) => `الشهر ${m}`} />
            <Legend />
            <Line type="monotone" dataKey="المستهدف التراكمي" stroke={SAND} strokeWidth={2.5} strokeDasharray="6 4" dot={false} />
            <Line type="monotone" dataKey="المحقق التراكمي" stroke={TEAL} strokeWidth={2.5} dot={{ r: 2.5 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="card">
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>
          {sel === "all" ? "نسبة إنجاز كل خطة" : "نسبة إنجاز كل مؤشر"}
        </div>
        <ResponsiveContainer width="100%" height={Math.max(200, bars.length * 44)}>
          <BarChart data={bars} layout="vertical" margin={{ top: 0, right: 30, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={LIGHT} horizontal={false} />
            <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} fontSize={11} />
            <YAxis type="category" dataKey="name" width={190} fontSize={11} />
            <Tooltip formatter={(v) => `${v}%`} />
            <Bar dataKey="نسبة الإنجاز" radius={[0, 6, 6, 0]}>
              {bars.map((b, i) => <Cell key={i} fill={b.late ? RED : TEALMID} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="mut" style={{ fontSize: 11 }}>العمود الأحمر = يحوي مهاماً متأخرة</div>
      </div>

      <div className="card">
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>توزيع حالات المهام</div>
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Pie data={pie} dataKey="value" nameKey="name" innerRadius={60} outerRadius={95}
              paddingAngle={2} label={(e) => `${e.name} (${e.value})`} fontSize={12}>
              {pie.map((s, i) => <Cell key={i} fill={s.color} />)}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}
