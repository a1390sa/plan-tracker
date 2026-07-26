-- صلاحية مدير النظام لتعديل ملفات المستخدمين (الترقية والتنزيل)
-- يُنفَّذ مرة واحدة في: Supabase ← SQL Editor ← New query
-- (الدالة SECURITY DEFINER تتجنب التكرار اللانهائي في سياسات RLS)

create or replace function is_admin_user() returns boolean
language sql security definer set search_path = public stable as $$
  select coalesce((select is_admin from profiles where id = auth.uid()), false);
$$;

drop policy if exists profiles_admin_update on profiles;
create policy profiles_admin_update on profiles for update to authenticated
  using (is_admin_user()) with check (is_admin_user());
