"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { can, phoneToEmail, requireRole } from "@/lib/auth";
import { dbError, fail, str } from "@/lib/form";
import { supabaseAdmin } from "@/lib/supabase/server";

const ROLES = ["manager", "production", "storekeeper", "accountant", "operator"];

export async function createUser(form: FormData) {
  await requireRole(can.users);
  const full_name = str(form, "full_name");
  const phone = str(form, "phone");
  const password = str(form, "password");
  const role = str(form, "role");
  if (!full_name || !phone || !role || !ROLES.includes(role)) fail("/users", "املأ الاسم والهاتف والدور.");
  if (!password || password.length < 6) fail("/users", "كلمة السر لازم تكون 6 أحرف أو أكثر.");
  const admin = supabaseAdmin();
  const { data, error } = await admin.auth.admin.createUser({ email: phoneToEmail(phone), password, email_confirm: true });
  if (error) fail("/users", error.message.includes("already") ? "هذا الرقم مسجل من قبل." : "تعذر إنشاء الحساب: " + error.message);
  const { error: pe } = await admin.from("profiles").insert({ id: data.user.id, full_name, phone, role });
  if (pe) {
    await admin.auth.admin.deleteUser(data.user.id);
    fail("/users", dbError(pe));
  }
  revalidatePath("/users");
  redirect("/users?ok=" + encodeURIComponent(`أُنشئ حساب ${full_name}. أعطه رقم هاتفه وكلمة السر.`));
}

export async function updateUser(form: FormData) {
  const me = await requireRole(can.users);
  const id = str(form, "id")!;
  const role = str(form, "role")!;
  const active = form.get("active") === "yes";
  if (id === me.id && (role !== "manager" || !active)) fail("/users", "لا يمكنك إزالة صلاحية المدير عن حسابك.");
  const admin = supabaseAdmin();
  const { error } = await admin.from("profiles").update({ role, active }).eq("id", id);
  if (error) fail("/users", dbError(error));
  const password = str(form, "password");
  if (password) {
    if (password.length < 6) fail("/users", "كلمة السر لازم تكون 6 أحرف أو أكثر.");
    const { error: e } = await admin.auth.admin.updateUserById(id, { password });
    if (e) fail("/users", "تعذر تغيير كلمة السر: " + e.message);
  }
  revalidatePath("/users");
  redirect("/users?ok=" + encodeURIComponent("تم الحفظ."));
}
