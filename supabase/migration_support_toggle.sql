-- السماح للمسؤول المساند (وليس فقط الرئيس) بتحديث حالة إنجاز المهمة
-- يُنفَّذ مرة واحدة في: Supabase ← SQL Editor ← New query

drop policy if exists tasks_primary_update on tasks;
create policy tasks_primary_update on tasks for update to authenticated
  using (exists(select 1 from task_assignments a where a.task_id = id and a.user_id = auth.uid() and a.role in ('primary','support')));
