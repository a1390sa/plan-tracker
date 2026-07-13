// حسابات الحالة والتقدم — مصدر الحقيقة الوحيد لمنطق «متأخرة»
export function currentMonthOf(plan, today = new Date()) {
  const idx = (today.getFullYear() - plan.start_year) * 12 + (today.getMonth() + 1) - plan.start_month + 1;
  return Math.min(Math.max(idx, 1), plan.months_count);
}
export function taskState(t, cur) {
  if (t.status === "done") return "done";
  if (t.status === "cancelled") return "cancelled";
  if (t.month_no < cur) return "late";
  if (t.month_no === cur) return "now";
  return "future";
}
export const stTxt = { done: "منجزة", late: "متأخرة", now: "الشهر الجاري", future: "قادمة", cancelled: "ملغاة" };
export function aggregates(tasks, cur) {
  const active = tasks.filter((t) => t.status !== "cancelled");
  const done = active.filter((t) => t.status === "done").length;
  const late = active.filter((t) => taskState(t, cur) === "late").length;
  const now = active.filter((t) => taskState(t, cur) === "now").length;
  const elapsed = active.filter((t) => t.month_no <= cur).length;
  return { total: active.length, done, late, now, gap: done - elapsed,
    pct: active.length ? Math.round((done / active.length) * 100) : 0 };
}
