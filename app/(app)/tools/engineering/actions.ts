"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { api650 } from "@/lib/engineering";
import { dbError, fail, str } from "@/lib/form";
import { supabase } from "@/lib/supabase/server";
import { partsFor, tankInput, vesselInput } from "./inputs";
import { vessel } from "@/lib/engineering";

const PATH: Record<string, string> = { vessel: "/tools/engineering", tank: "/tools/engineering/tank" };

export async function saveCalc(form: FormData) {
  const db = await supabase();
  const kind = str(form, "kind")!;
  const raw = JSON.parse(str(form, "inputs") ?? "{}") as Record<string, string>;
  const qs = new URLSearchParams(raw).toString();
  const back = `${PATH[kind] ?? "/tools/engineering"}?${qs}`;
  const orderId = str(form, "order_id");
  const withParts = form.get("parts") === "on" && !!orderId;

  let results: Record<string, unknown> = {};
  if (kind === "vessel") {
    const r = vessel(vesselInput(raw).inp);
    results = { tShell: r.tShell, tHead: r.tHead, mawp: r.mawp, hydro: r.hydro, liters: r.liters, emptyKg: r.emptyKg, blank: r.blank };
  } else if (kind === "tank") {
    const r = api650(tankInput(raw).inp);
    results = { courses: r.courses.map((c) => c.t), tBottom: r.tBottom, nominal: r.nominal, totalKg: r.totalKg };
  }
  const parts = partsFor(kind, raw);

  const { error } = await db.from("calcs").insert({ kind, title: str(form, "title") ?? "حساب", order_id: orderId, inputs: raw, results });
  if (error) fail(back, dbError(error));
  if (withParts && parts.length) {
    const { error: e2 } = await db.from("cut_parts").insert(parts.map((p) => ({ ...p, order_id: orderId })));
    if (e2) fail(back, dbError(e2));
    revalidatePath(`/orders/${orderId}`);
    redirect(`/orders/${orderId}?ok=${encodeURIComponent("انحفظ الحساب وانضافت القطع لقائمة القص.")}#cutting`);
  }
  revalidatePath("/tools/engineering/saved");
  redirect(`${back}&ok=${encodeURIComponent("انحفظ الحساب.")}`);
}

export async function deleteCalc(form: FormData) {
  const db = await supabase();
  const { error } = await db.from("calcs").delete().eq("id", str(form, "id")!);
  if (error) fail("/tools/engineering/saved", dbError(error));
  revalidatePath("/tools/engineering/saved");
}
