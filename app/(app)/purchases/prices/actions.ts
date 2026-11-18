"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { dbError, fail, numOrNull, str } from "@/lib/form";
import { supabase } from "@/lib/supabase/server";

const back = "/purchases/prices";

export async function savePrice(form: FormData) {
  const db = await supabase();
  const price = numOrNull(form, "price_ton");
  if (!price || price <= 0) fail(back, "اكتب السعر للطن.");
  const { error } = await db.from("steel_prices").insert({
    day: str(form, "day") ?? undefined,
    item: str(form, "item") ?? "صاج أسود",
    grade: str(form, "grade"),
    thickness: str(form, "thickness"),
    price_ton: price,
    currency: str(form, "currency") === "IQD" ? "IQD" : "USD",
    source: str(form, "source"),
    note: str(form, "note"),
  });
  if (error) fail(back, dbError(error));
  revalidatePath(back);
  redirect(`${back}?ok=${encodeURIComponent("انحفظ السعر")}`);
}

export async function deletePrice(form: FormData) {
  const db = await supabase();
  const { error } = await db.from("steel_prices").delete().eq("id", str(form, "id")!);
  if (error) fail(back, dbError(error));
  revalidatePath(back);
}
