// إنشاء أول حساب مدير. التشغيل:
//   node --env-file=.env.local scripts/create-manager.mjs "الاسم" 07XXXXXXXXX كلمة_السر
import { createClient } from "@supabase/supabase-js";

const [name, phone, password] = process.argv.slice(2);
if (!name || !phone || !password) {
  console.error('الاستخدام: node --env-file=.env.local scripts/create-manager.mjs "الاسم" 07XXXXXXXXX كلمة_السر');
  process.exit(1);
}

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const digits = phone.replace(/\D/g, "").replace(/^964/, "0");
const { data, error } = await admin.auth.admin.createUser({
  email: `${digits}@users.alsakb.app`,
  password,
  email_confirm: true,
});
if (error) {
  console.error("تعذر إنشاء الحساب:", error.message);
  process.exit(1);
}
const { error: pe } = await admin.from("profiles").insert({ id: data.user.id, full_name: name, phone, role: "manager" });
if (pe) {
  console.error("تعذر حفظ الملف الشخصي:", pe.message);
  process.exit(1);
}
console.log(`تم. ادخل بالرقم ${phone} وكلمة السر.`);
