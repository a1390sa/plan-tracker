-- ربط كل مهمة "جزئية" بمهمتها "الأساسية" الأم (بدل تصنيفَين منفصلين بلا رابط)
-- يُنفَّذ مرة واحدة في: Supabase ← SQL Editor ← New query

alter table tasks add column if not exists parent_task_id uuid references tasks(id) on delete set null;
