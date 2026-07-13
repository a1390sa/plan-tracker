import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error("لم تُضبط متغيرات البيئة VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY — راجع ملف .env.example");
}
export const supabase = createClient(url, key);
