import { redirect } from "next/navigation";
import { cache } from "react";
import { supabase } from "./supabase/server";

export type Role = "manager" | "production" | "storekeeper" | "accountant" | "operator";
export type Me = { id: string; full_name: string; phone: string; role: Role };

export const getMe = cache(async (): Promise<Me> => {
  const db = await supabase();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect("/login");
  const { data } = await db.from("profiles").select("id, full_name, phone, role, active").eq("id", user.id).single();
  if (!data || !data.active) redirect("/login?error=" + encodeURIComponent("حسابك غير مفعّل. راجع المدير."));
  return data as Me;
});

export const can = {
  finance: (r: Role) => r === "manager" || r === "accountant",
  production: (r: Role) => r === "manager" || r === "production",
  stock: (r: Role) => r === "manager" || r === "storekeeper",
  attendance: (r: Role) => r === "manager" || r === "production" || r === "accountant",
  stages: (r: Role) => r === "manager" || r === "production" || r === "operator",
  users: (r: Role) => r === "manager",
};

export async function requireRole(check: (r: Role) => boolean) {
  const me = await getMe();
  if (!check(me.role)) redirect("/?error=" + encodeURIComponent("ليس لديك صلاحية لهذه الصفحة."));
  return me;
}

// رقم الهاتف هو اسم الدخول؛ Supabase يحتاج بريداً فنحوّله لعنوان داخلي
export function phoneToEmail(phone: string) {
  const digits = phone.replace(/\D/g, "").replace(/^964/, "0");
  return `${digits}@users.alsakb.app`;
}
