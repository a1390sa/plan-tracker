-- ============================================================
-- ترقيع أمني — 13 أغسطس 2026 (PT-01, PT-02, PT-03, PT-06)
-- آمن لإعادة التنفيذ (idempotent) — يُنفَّذ على قاعدة بيانات حية قائمة
-- ============================================================

create or replace function is_admin_user() returns boolean
language sql security definer set search_path = public stable as $$
  select coalesce((select is_admin from profiles where id = auth.uid()), false);
$$;

-- PT-01: منع أي مستخدم من ترقية نفسه لمدير نظام
create or replace function prevent_privilege_escalation() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.is_admin is distinct from old.is_admin then
    if not is_admin_user() then
      raise exception 'غير مصرح: لا يمكنك تغيير صلاحية المدير';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists guard_is_admin on profiles;
create trigger guard_is_admin before update on profiles
  for each row execute function prevent_privilege_escalation();

-- PT-02: تخزين الملفات مقصور على مجلد المالك
drop policy if exists plans_storage_rw on storage.objects;
create policy plans_storage_rw on storage.objects for all to authenticated
  using (bucket_id = 'plans' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'plans' and (storage.foldername(name))[1] = auth.uid()::text);

-- PT-03: قراءة الملفات الشخصية مقصورة على الذات أو من يشاركك خطة أو المدير
drop policy if exists profiles_read on profiles;
create policy profiles_read on profiles for select to authenticated using (
  id = auth.uid()
  or exists (
    select 1 from plan_members pm1 join plan_members pm2 on pm1.plan_id = pm2.plan_id
    where pm1.user_id = auth.uid() and pm2.user_id = profiles.id
  )
  or is_admin_user()
);

-- PT-06: المسؤول الرئيس (غير المدير) يحدّث حالة المهمة فقط، لا تفاصيلها
create or replace function guard_task_primary_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if is_plan_manager((select plan_id from indicators where id = old.indicator_id)) then
    return new;
  end if;
  if new.indicator_id is distinct from old.indicator_id
     or new.month_no is distinct from old.month_no
     or new.description is distinct from old.description then
    raise exception 'المسؤول الرئيس يحدّث حالة المهمة فقط، لا تفاصيلها — استخدم طلب تغيير';
  end if;
  return new;
end $$;
drop trigger if exists guard_task_update on tasks;
create trigger guard_task_update before update on tasks
  for each row execute function guard_task_primary_update();
