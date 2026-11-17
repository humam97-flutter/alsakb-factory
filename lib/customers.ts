import type { supabase } from "@/lib/supabase/server";

type Db = Awaited<ReturnType<typeof supabase>>;

// يرجع زبون بهذا الاسم أو يسوي واحد جديد
export async function ensureCustomer(db: Db, name: string | null, phone: string | null) {
  if (!name) return null;
  const { data: found } = await db.from("customers").select("id, phone").ilike("name", name.replace(/[%_\\]/g, "\\$&")).maybeSingle();
  if (found) {
    if (phone && !found.phone) await db.from("customers").update({ phone }).eq("id", found.id);
    return found.id as string;
  }
  const { data } = await db.from("customers").insert({ name, phone }).select("id").single();
  return (data?.id as string) ?? null;
}

