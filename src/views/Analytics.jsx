import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase.js";
import { currentMonthOf, taskState, stTxt, aggregates } from "../lib/compute.js";
import {
  ResponsiveContainer, ComposedChart, LineChart, Line, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import Gauge from "../components/Gauge.jsx";

const TEAL = "#0E5E4E", TEALMID = "#2E8B76", SAND = "#C9A15C",
      RED = "#B3402F", AMBER = "#B37E17", GRAY = "#B9C4C0", LIGHT = "#DCE5E2";

export default function Analytics({ me }) {
  const [plans, setPlans] = useState(null);
  const [sel, setSel] = useState("all");
  const [kindFilter, setKindFilter] = useState("all");
  const [err, setErr] = useState("");

  useEffect(() => {
    supabase.from("plans")
      .select("*, indicators(id, name, sort_order, tasks(id, month_no, status, description, task_kind))")
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

    const planCards = perPlan.map(({ p, ag }) => ({ id: p.id, name: p.name, pct: ag.pct, done: ag.done, total: ag.total }));

    let detail = null;
    if (sel !== "all") {
      const { p, tasks, cur, ag } = perPlan[0];
      const active = tasks.filter((t) => t.status !== "cancelled");
      const monthly = [];
      for (let m = 1; m <= p.months_count; m++) {
        const due = active.filter((t) => t.month_no === m);
        const done = due.filter((t) => t.status === "done").length;
        monthly.push({ month: m, "مهام مستحقة": due.length, "نسبة الإنجاز": due.length ? Math.round((done / due.length) * 100) : 0 });
      }
      const curTasks = active.filter((t) => t.month_no === cur);
      const basicList = active.filter((t) => t.task_kind !== "sub").sort((a, b) => a.month_no - b.month_no);
      const subList = active.filter((t) => t.task_kind === "sub").sort((a, b) => a.month_no - b.month_no);
      detail = {
        cur, ag,
        monthly,
        curTasks,
        basicList, subList,
        curDone: curTasks.filter((t) => t.status === "done").length,
        curPending: curTasks.filter((t) => t.status !== "done").length,
      };
    }

    return { totals, line, pie, planCards, detail };
  }, [plans, sel]);

  if (err) return <div className="alert-err">⚠ {err}</div>;
  if (plans === null) return <div className="mut">جارٍ التحميل…</div>;
  if (!plans.length) return <div className="card" style={{ textAlign: "center", color: "var(--mut)" }}>لا توجد خطط بعد — ارفع خطة أولاً ثم عد للوحة التحكم.</div>;

  const { totals, line, pie, planCards, detail } = view;
  const applyKindFilter = (list) => list.filter((t) => {
    if (kindFilter === "done") return t.status === "done";
    if (kindFilter === "basic") return t.task_kind !== "sub";
    if (kindFilter === "sub") return t.task_kind === "sub";
    return true;
  });

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

      {sel === "all" ? (
        <>
          <div className="row">
            {[
              ["نسبة الإنجاز", `${totals.pct}%`, `عبر ${totals.plans} خطط`, TEAL],
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
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12 }}>نسبة إنجاز كل خطة</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
              {planCards.map((c) => (
                <div key={c.id} className="card" style={{ textAlign: "center", cursor: "pointer" }} onClick={() => setSel(c.id)}>
                  <div style={{ background: "var(--teal)", color: "#fff", borderRadius: 10, padding: "8px 6px", fontWeight: 700, fontSize: 12.5, marginBottom: 10 }}>
                    {c.name}
                  </div>
                  <Gauge value={c.pct} size={120} />
                  <div className="row" style={{ marginTop: 8, gap: 6 }}>
                    <div style={{ flex: 1, background: "var(--sand-soft)", color: "var(--sand-ink)", borderRadius: 8, padding: "6px 4px" }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{c.done}</div>
                      <div style={{ fontSize: 10 }}>المنجز</div>
                    </div>
                    <div style={{ flex: 1, background: "#EEF1F0", color: "var(--mut)", borderRadius: 8, padding: "6px 4px" }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{c.total}</div>
                      <div style={{ fontSize: 10 }}>إجمالي المهام</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
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
      ) : (
        <div className="dashboard-detail">
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {kindFilter !== "sub" && (
              <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                <div className="card-head">المهام الأساسية</div>
                <ol style={{ maxHeight: 320, overflowY: "auto", margin: 0, padding: "10px 26px 10px 10px", fontSize: 12.5 }}>
                  {applyKindFilter(detail.basicList).map((t) => (
                    <li key={t.id} style={{ padding: "4px 0", color: t.status === "done" ? "var(--mut)" : "var(--ink)", textDecoration: t.status === "done" ? "line-through" : "none" }}>
                      {t.description} <span className="mut">(شهر {t.month_no})</span>
                    </li>
                  ))}
                  {!applyKindFilter(detail.basicList).length && <li className="mut" style={{ listStyle: "none" }}>لا توجد مهام</li>}
                </ol>
              </div>
            )}
            {kindFilter !== "basic" && (
              <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                <div className="card-head">المهام الجزئية</div>
                <ol style={{ maxHeight: 320, overflowY: "auto", margin: 0, padding: "10px 26px 10px 10px", fontSize: 12.5 }}>
                  {applyKindFilter(detail.subList).map((t) => (
                    <li key={t.id} style={{ padding: "4px 0", color: t.status === "done" ? "var(--mut)" : "var(--ink)", textDecoration: t.status === "done" ? "line-through" : "none" }}>
                      {t.description} <span className="mut">(شهر {t.month_no})</span>
                    </li>
                  ))}
                  {!applyKindFilter(detail.subList).length && <li className="mut" style={{ listStyle: "none" }}>لا توجد مهام</li>}
                </ol>
              </div>
            )}
          </div>

          <div className="card" style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
            <Gauge value={detail.ag.pct} size={170} />
            <div style={{ fontSize: 42, fontWeight: 700, color: "var(--red)", lineHeight: 1 }}>{detail.ag.total}</div>
            <div className="mut">عدد المهام</div>
            <div className="row" style={{ justifyContent: "center", gap: 6, flexWrap: "wrap" }}>
              {[["all", "الكل"], ["done", "المنجز"], ["basic", "الأساسية"], ["sub", "الجزئية"]].map(([k, l]) => (
                <button key={k} className={`chip ${kindFilter === k ? "on" : ""}`} onClick={() => setKindFilter(k)}>{l}</button>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="card">
              <div className="mut" style={{ fontWeight: 700, fontSize: 13, marginBottom: 10, color: "var(--ink)" }}>المهام المستحقة شهرياً</div>
              <ResponsiveContainer width="100%" height={220}>
                <ComposedChart data={detail.monthly} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={LIGHT} />
                  <XAxis dataKey="month" tickFormatter={(m) => `ش${m}`} fontSize={11} />
                  <YAxis yAxisId="count" fontSize={11} allowDecimals={false} />
                  <YAxis yAxisId="pct" orientation="left" hide domain={[0, 100]} />
                  <Tooltip labelFormatter={(m) => `الشهر ${m}`} />
                  <Legend />
                  <Bar yAxisId="count" dataKey="مهام مستحقة" fill={TEALMID} radius={[4, 4, 0, 0]} />
                  <Line yAxisId="pct" type="monotone" dataKey="نسبة الإنجاز" stroke={SAND} strokeWidth={2.5} dot={{ r: 2.5 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              <div className="card-head">مهام الشهر الحالي (شهر {detail.cur})</div>
              <div style={{ maxHeight: 280, overflowY: "auto" }}>
                <table className="tbl">
                  <thead>
                    <tr><th>المهمة الأساسية</th><th>المهمة الجزئية</th><th>نهاية الاستحقاق</th><th>حالة الإنجاز</th></tr>
                  </thead>
                  <tbody>
                    {applyKindFilter(detail.curTasks).map((t) => (
                      <tr key={t.id}>
                        <td>{t.task_kind !== "sub" ? t.description : "—"}</td>
                        <td>{t.task_kind === "sub" ? t.description : "—"}</td>
                        <td>شهر {t.month_no}</td>
                        <td>{stTxt[taskState(t, detail.cur)]}</td>
                      </tr>
                    ))}
                    {!applyKindFilter(detail.curTasks).length && (
                      <tr><td colSpan={4} className="mut" style={{ textAlign: "center" }}>لا توجد مهام هذا الشهر</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="row">
              {[
                ["عدد المهام", detail.curTasks.length, TEALMID],
                ["المنجز", detail.curDone, TEAL],
                ["في الانتظار", detail.curPending, detail.curPending ? AMBER : TEAL],
              ].map(([l, v, c]) => (
                <div key={l} className="card kpi">
                  <div className="mut">{l}</div>
                  <div className="v" style={{ color: c }}>{v}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
