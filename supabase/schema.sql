-- ============================================================
-- نظام متابعة تنفيذ الخطط — بنية قاعدة البيانات (الإصدار 1.2)
-- يُنفَّذ مرة واحدة في: Supabase > SQL Editor > New query
-- ============================================================

-- ── الملفات الشخصية (تمتد من نظام المصادقة) ──
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  email text not null default '',
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

-- إنشاء الملف الشخصي تلقائياً عند التسجيل
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email,'@',1)), new.email);
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- ── الخطط ──
create table if not exists plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  months_count int not null check (months_count between 12 and 60 and months_count % 12 = 0),
  start_year int not null,
  start_month int not null default 1 check (start_month between 1 and 12),
  owner_id uuid not null references profiles(id),
  source_path text,
  created_at timestamptz not null default now()
);

-- ── أعضاء الخطة وأدوارهم ──
create table if not exists plan_members (
  plan_id uuid not null references plans(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  role text not null check (role in ('manager','executor','viewer')),
  primary key (plan_id, user_id)
);

-- ── المؤشرات / المراحل ──
create table if not exists indicators (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references plans(id) on delete cascade,
  name text not null,
  total_target int not null default 0,
  sort_order int not null default 0
);

-- ── المهام ──
create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  indicator_id uuid not null references indicators(id) on delete cascade,
  month_no int not null check (month_no between 1 and 60),
  description text not null,
  status text not null default 'pending' check (status in ('pending','done','cancelled')),
  task_kind text not null default 'basic' check (task_kind in ('basic','sub')),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists tasks_indicator_idx on tasks(indicator_id);

-- ── إسناد المهام: رئيس واحد إلزاماً وعدد مفتوح من المساندين ──
create table if not exists task_assignments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  role text not null check (role in ('primary','support')),
  created_at timestamptz not null default now(),
  unique (task_id, user_id)
);
-- قيد: مسؤول رئيس واحد فقط لكل مهمة
create unique index if not exists one_primary_per_task
  on task_assignments(task_id) where (role = 'primary');

-- ── سجل التغييرات (إدارة التغيير المرن) ──
create table if not exists task_changes (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  change_type text not null check (change_type in ('move_month','edit_desc','reassign','cancel')),
  old_value text,
  new_value text,
  reason text not null,
  requested_by uuid not null references profiles(id),
  approved_by uuid references profiles(id),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

-- ── سجل التنبيهات المرسلة ──
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references tasks(id) on delete set null,
  recipient uuid not null references profiles(id),
  kind text not null,
  sent_at timestamptz not null default now()
);
create index if not exists notif_recent_idx on notifications(recipient, kind, sent_at);

-- ============================================================
-- أمان الصفوف (RLS)
-- ============================================================
alter table profiles enable row level security;
alter table plans enable row level security;
alter table plan_members enable row level security;
alter table indicators enable row level security;
alter table tasks enable row level security;
alter table task_assignments enable row level security;
alter table task_changes enable row level security;
alter table notifications enable row level security;

-- دوال مساعدة
create or replace function is_plan_member(p uuid) returns boolean
language sql security definer set search_path = public stable as $$
  select exists(select 1 from plan_members where plan_id = p and user_id = auth.uid())
      or exists(select 1 from plans where id = p and owner_id = auth.uid())
      or exists(select 1 from profiles where id = auth.uid() and is_admin);
$$;
create or replace function is_plan_manager(p uuid) returns boolean
language sql security definer set search_path = public stable as $$
  select exists(select 1 from plan_members where plan_id = p and user_id = auth.uid() and role = 'manager')
      or exists(select 1 from plans where id = p and owner_id = auth.uid())
      or exists(select 1 from profiles where id = auth.uid() and is_admin);
$$;
create or replace function task_plan(t uuid) returns uuid
language sql security definer set search_path = public stable as $$
  select i.plan_id from tasks k join indicators i on i.id = k.indicator_id where k.id = t;
$$;
create or replace function is_admin_user() returns boolean
language sql security definer set search_path = public stable as $$
  select coalesce((select is_admin from profiles where id = auth.uid()), false);
$$;

-- profiles: كل مسجَّل يقرأ ملفه أو ملفات من يشاركونه خطة، ويعدّل ملفه فقط
create policy profiles_read on profiles for select to authenticated using (
  id = auth.uid()
  or exists (
    select 1 from plan_members pm1 join plan_members pm2 on pm1.plan_id = pm2.plan_id
    where pm1.user_id = auth.uid() and pm2.user_id = profiles.id
  )
  or is_admin_user()
);
create policy profiles_update on profiles for update to authenticated using (id = auth.uid());

-- PT-01: منع أي مستخدم من ترقية نفسه لمدير نظام (id=auth.uid() لا يقيّد الأعمدة القابلة للتعديل)
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

-- plans
create policy plans_read on plans for select to authenticated using (is_plan_member(id));
create policy plans_insert on plans for insert to authenticated with check (owner_id = auth.uid());
create policy plans_update on plans for update to authenticated using (is_plan_manager(id));
create policy plans_delete on plans for delete to authenticated using (owner_id = auth.uid());

-- plan_members
create policy members_read on plan_members for select to authenticated using (is_plan_member(plan_id));
create policy members_write on plan_members for all to authenticated
  using (is_plan_manager(plan_id)) with check (is_plan_manager(plan_id));

-- indicators
create policy ind_read on indicators for select to authenticated using (is_plan_member(plan_id));
create policy ind_write on indicators for all to authenticated
  using (is_plan_manager(plan_id)) with check (is_plan_manager(plan_id));

-- tasks: القراءة للأعضاء، الإدارة للمدير،
-- وتحديث الحالة للمسؤول الرئيس (يُضبط تفصيلاً في سياسة التحديث)
create policy tasks_read on tasks for select to authenticated
  using (is_plan_member((select plan_id from indicators where id = indicator_id)));
create policy tasks_manager_all on tasks for all to authenticated
  using (is_plan_manager((select plan_id from indicators where id = indicator_id)))
  with check (is_plan_manager((select plan_id from indicators where id = indicator_id)));
create policy tasks_primary_update on tasks for update to authenticated
  using (exists(select 1 from task_assignments a where a.task_id = id and a.user_id = auth.uid() and a.role = 'primary'));

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

-- task_assignments: القراءة للأعضاء، الكتابة لمدير الخطة
create policy assign_read on task_assignments for select to authenticated
  using (is_plan_member(task_plan(task_id)));
create policy assign_write on task_assignments for all to authenticated
  using (is_plan_manager(task_plan(task_id))) with check (is_plan_manager(task_plan(task_id)));

-- task_changes: القراءة للأعضاء، الطلب لأي عضو، الاعتماد للمدير
create policy changes_read on task_changes for select to authenticated
  using (is_plan_member(task_plan(task_id)));
create policy changes_insert on task_changes for insert to authenticated
  with check (requested_by = auth.uid() and is_plan_member(task_plan(task_id)));
create policy changes_decide on task_changes for update to authenticated
  using (is_plan_manager(task_plan(task_id)));

-- notifications: كلٌّ يقرأ تنبيهاته (الكتابة من وظيفة الخادم بمفتاح الخدمة)
create policy notif_read on notifications for select to authenticated using (recipient = auth.uid());

-- ============================================================
-- مخزن الملفات: أنشئ من الواجهة Bucket باسم plans (خاص)
-- ثم نفّذ سياساته:
-- ============================================================
insert into storage.buckets (id, name, public) values ('plans','plans',false)
on conflict (id) do nothing;
-- PT-02: كل مستخدم يصل فقط لمجلده الخاص (المسار: <uid>/...) لا لملفات الجهات الأخرى
create policy plans_storage_rw on storage.objects for all to authenticated
  using (bucket_id = 'plans' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'plans' and (storage.foldername(name))[1] = auth.uid()::text);
