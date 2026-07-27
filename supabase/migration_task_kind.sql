-- تصنيف المهام (أساسية/جزئية) — لقواعد البيانات القائمة فعلاً (غيث وهداية)
-- يُنفَّذ مرة واحدة في: Supabase ← SQL Editor ← New query
-- المشاريع الجديدة لا تحتاج هذا الملف — العمود مضاف مباشرة في schema.sql

alter table tasks add column if not exists task_kind text
  not null default 'basic' check (task_kind in ('basic','sub'));
