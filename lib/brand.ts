import { cache } from "react";
import { supabase } from "./supabase/server";

export type Brand = {
  name: string;
  logo: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  reg_no: string | null;
  manager_name: string | null;
  footer: string | null;
};

export const logoUrl = (path: string | null | undefined) =>
  path ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/branding/${path}` : null;

// بيانات ترويسة المعمل (الاسم والشعار) من الإعدادات
export const getBrand = cache(async (): Promise<Brand> => {
  const db = await supabase();
  const { data: s } = await db.from("settings").select("*").eq("id", 1).maybeSingle();
  return {
    name: s?.factory_name || "معمل السكب الحديدي",
    logo: logoUrl(s?.logo_path),
    address: s?.address ?? null,
    phone: s?.phone ?? null,
    email: s?.email ?? null,
    reg_no: s?.reg_no ?? null,
    manager_name: s?.manager_name ?? null,
    footer: s?.invoice_footer ?? null,
  };
});
