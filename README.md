# نظام متابعة تنفيذ الخطط — دليل النشر والتشغيل (الإصدار 1.2)

نظام ويب عربي (RTL) يقرأ خطط الإكسل المعدّة وفق القالب المعتمد، ويحوّلها إلى لوحة متابعة حيّة
بإسناد متعدد (رئيس ومساندون)، وإدارة تغيير مرنة بسجل اعتماد، وتنبيهات بريدية يومية.

**التكلفة الشهرية: صفر** ضمن الخطط المجانية (Supabase + Vercel + Resend).

---

## المتطلبات قبل البدء
- حساب بريد إلكتروني تنشئ به الحسابات الثلاثة أدناه.
- تثبيت Node.js (النسخة 18 فأعلى) من nodejs.org — للنشر فقط، لا للتشغيل اليومي.

## الخطوة 1: قاعدة البيانات (Supabase) — 10 دقائق
1. أنشئ حساباً في supabase.com ثم أنشئ مشروعاً جديداً (اختر منطقة قريبة مثل Frankfurt).
2. من القائمة اليسرى افتح **SQL Editor** > **New query**، والصق محتوى الملف
   `supabase/schema.sql` كاملاً ثم اضغط **Run**. سترى Success — بهذا أُنشئت الجداول
   والصلاحيات ومخزن الملفات دفعة واحدة.
3. من **Authentication > Providers** تأكد أن Email مفعّل.
   (اختياري للتجربة السريعة: عطّل "Confirm email" مؤقتاً من إعدادات Email.)
4. من **Settings > API** انسخ قيمتين ستحتاجهما لاحقاً:
   - `Project URL`
   - `anon public key`

## الخطوة 2: البريد (Resend) — 5 دقائق
1. أنشئ حساباً في resend.com ثم من **API Keys** أنشئ مفتاحاً وانسخه.
2. (اختياري لاحقاً) أضف نطاق جهتك من **Domains** لترسل الرسائل باسم جهتك؛
   وقبل ذلك سيعمل الإرسال من العنوان التجريبي `onboarding@resend.dev`.

## الخطوة 3: وظيفة التنبيهات اليومية — 10 دقائق
تُنفَّذ من سطر الأوامر (مرة واحدة):
```bash
npm install -g supabase
supabase login
cd plan-tracker
supabase link --project-ref <معرف مشروعك من رابط اللوحة>
supabase secrets set RESEND_API_KEY=<مفتاح Resend>
supabase secrets set MAIL_FROM=onboarding@resend.dev
supabase secrets set APP_URL=<رابط تطبيقك بعد الخطوة 4>
supabase functions deploy send-notifications --no-verify-jwt
```
ثم الجدولة اليومية (6 صباحاً بتوقيت الرياض = 03:00 UTC): من لوحة Supabase افتح
**SQL Editor** ونفّذ (استبدل YOUR_PROJECT_REF و YOUR_ANON_KEY):
```sql
select cron.schedule(
  'daily-notifications', '0 3 * * *',
  $$ select net.http_post(
       url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-notifications',
       headers := '{"Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb
     ) $$
);
```
(إن ظهرت رسالة عن امتداد غير مفعّل: فعّل `pg_cron` و `pg_net` من Database > Extensions.)

للتجربة الفورية دون انتظار الموعد:
```bash
curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-notifications \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

## الخطوة 4: نشر الواجهة (Vercel) — 10 دقائق
1. ارفع مجلد المشروع إلى مستودع GitHub (خاص أو عام).
2. أنشئ حساباً في vercel.com > **Add New Project** > اختر المستودع.
3. في شاشة الإعداد أضف متغيرين في **Environment Variables**:
   - `VITE_SUPABASE_URL` = قيمة Project URL
   - `VITE_SUPABASE_ANON_KEY` = قيمة anon public key
4. اضغط **Deploy**. بعد دقيقة يظهر رابط تطبيقك — هذا هو النظام.

## الخطوة 5: التشغيل الأول — 5 دقائق
1. افتح الرابط وأنشئ حسابك (سيكون أول مستخدم).
2. لجعل حسابك «مدير نظام»: من Supabase > **Table Editor** > جدول `profiles`
   غيّر `is_admin` لحسابك إلى `true`.
3. اطلب من الموظفين إنشاء حساباتهم بالرابط نفسه.
4. ارفع أول خطة إكسل، ثم من تبويب **الأعضاء** أضف الموظفين ببريدهم،
   ومن **لوحة المتابعة** أسند لكل مهمة مسؤولاً رئيساً ومساندين.

---

## التشغيل اليومي (لا يحتاج تقنياً)
- **المنفّذ**: يفتح النظام، يؤشّر مهامه المنجزة، ويقدّم «طلب تغيير» عند الحاجة.
- **مدير الخطة**: يتابع اللوحة، يعتمد أو يرفض طلبات التغيير من تبويبها، ويصله ملخص كل أحد.
- **التنبيهات**: تصل آلياً — تذكير بداية/منتصف الشهر، إنذار قبل النهاية بثلاثة أيام،
  وتصعيد كل 3 أيام على المتأخر (للرئيس، وبعد أسبوعين يُضاف المدير)، مجمّعةً في رسالة واحدة يومياً.

## مهام فني الصيانة (شهرياً — نصف ساعة)
1. فحص استهلاك Supabase (Database/Storage) و Resend (عدد الرسائل) من لوحتيهما.
2. التأكد من عمل الجدولة: Supabase > Edge Functions > Logs.
3. أخذ نسخة يدوية إضافية عند الحاجة: Database > Backups.

## استكشاف الأخطاء
| العرض | السبب الأرجح | الحل |
|---|---|---|
| «الملف لا يطابق القالب» | تغيّرت ترويسة الصف الثاني | أعد مسميات: المؤشر، المستهدف، التنفيذ |
| لا تصل الرسائل | مفتاح Resend أو الجدولة | راجع Secrets وسجل cron في SQL: `select * from cron.job;` |
| «بيانات الدخول غير صحيحة» | تأكيد البريد مفعّل ولم يُؤكد | أكّد البريد أو عطّل التأكيد مؤقتاً |
| مستخدم لا يرى الخطة | ليس عضواً فيها | أضفه من تبويب الأعضاء |

## بنية المشروع
```
plan-tracker/
├── supabase/schema.sql                    قاعدة البيانات والصلاحيات (تنفيذ مرة واحدة)
├── supabase/functions/send-notifications/ وظيفة التنبيهات اليومية
├── src/lib/parser.js                      محلّل القالب المعتمد
├── src/lib/compute.js                     منطق الحالات والنِّسب
├── src/views/                             الشاشات: الدخول، الخطط، اللوحة، التغييرات، الأعضاء
└── README.md                              هذا الدليل
```
