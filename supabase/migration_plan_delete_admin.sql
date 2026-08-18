-- السماح لمدير النظام (is_admin) بحذف أي خطة، وليس فقط صاحبها
-- يُنفَّذ مرة واحدة في: Supabase ← SQL Editor ← New query

drop policy if exists plans_delete on plans;
create policy plans_delete on plans for delete to authenticated
  using (owner_id = auth.uid() or is_admin_user());
