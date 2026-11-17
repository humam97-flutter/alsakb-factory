"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getMe } from "@/lib/auth";
import { getCutSettings, proposeForOrder } from "@/lib/cutting";
import { dbError, fail, numOrNull, str } from "@/lib/form";
import { supabase } from "@/lib/supabase/server";

const ok = (path: string, msg: string) => redirect(`${path}${path.includes("?") ? "&" : "?"}ok=${encodeURIComponent(msg)}`);

// ---------- الألواح ----------
export async function savePlates(form: FormData) {
  const db = await supabase();
  const back = "/cutting";
  const L = numOrNull(form, "length_mm"), W = numOrNull(form, "width_mm"), t = numOrNull(form, "thickness");
  const count = Math.max(1, Math.min(200, Math.floor(numOrNull(form, "count") ?? 1)));
  if (!L || !W || !t) fail(back, "اكتب الطول والعرض والسمك.");
  const row = {
    grade: str(form, "grade") ?? "A36",
    thickness: t,
    length_mm: Math.max(L, W),
    width_mm: Math.min(L, W),
    density: numOrNull(form, "density") ?? 7.85,
    heat_no: str(form, "heat_no"),
    cert_no: str(form, "cert_no"),
    price_kg: numOrNull(form, "price_kg") ?? 0,
    location: str(form, "location"),
    supplier_id: str(form, "supplier_id"),
    received_on: str(form, "received_on") ?? undefined,
    notes: str(form, "notes"),
  };
  const { error } = await db.from("plates").insert(Array.from({ length: count }, () => row));
  if (error) fail(back, dbError(error));
  revalidatePath(back);
  ok(back, count > 1 ? `انضافت ${count} ألواح.` : "انضاف اللوح.");
}

export async function deletePlate(form: FormData) {
  const db = await supabase();
  const { error } = await db.from("plates").delete().eq("id", str(form, "id")!).eq("status", "available");
  if (error) fail("/cutting", dbError(error));
  revalidatePath("/cutting");
}

// ---------- قطع الأمر ----------
export async function savePart(form: FormData) {
  const db = await supabase();
  const orderId = str(form, "order_id")!;
  const back = `/orders/${orderId}#cutting`;
  const shape = str(form, "shape") ?? "rect";
  const t = numOrNull(form, "thickness");
  if (!t) fail(back, "اكتب سمك القطعة.");
  const a = numOrNull(form, "a"), b = numOrNull(form, "b");
  if (!a || (shape !== "circle" && !b)) fail(back, shape === "rect" ? "اكتب طول وعرض القطعة." : shape === "ring" ? "اكتب القطر الخارجي وقطر الفتحة." : "اكتب القطر.");
  const { error } = await db.from("cut_parts").insert({
    order_id: orderId,
    name: str(form, "name") ?? "قطعة",
    shape,
    grade: str(form, "grade") ?? "A36",
    thickness: t,
    ...(shape === "rect" ? { length_mm: Math.max(a!, b!), width_mm: Math.min(a!, b!) } : { diameter_mm: a, inner_mm: shape === "ring" ? b : null }),
    qty: Math.max(1, Math.floor(numOrNull(form, "qty") ?? 1)),
  });
  if (error) fail(back, dbError(error));
  revalidatePath(`/orders/${orderId}`);
  redirect(back);
}

export async function deletePart(form: FormData) {
  const db = await supabase();
  const orderId = str(form, "order_id")!;
  const { error } = await db.from("cut_parts").delete().eq("id", str(form, "id")!);
  if (error) fail(`/orders/${orderId}`, dbError(error));
  revalidatePath(`/orders/${orderId}`);
}

// ---------- المخططات ----------
// اعتماد الاقتراح: يمسح مسودات الأمر القديمة، ويحجز الألواح المختارة. الحساب يعاد هنا بالسيرفر.
export async function approveProposal(form: FormData) {
  await getMe();
  const db = await supabase();
  const orderId = str(form, "order_id")!;
  const back = `/cutting/order/${orderId}`;
  const s = await getCutSettings();
  const old = await db.from("cut_plans").select("id, plate_id").eq("order_id", orderId).eq("status", "draft");
  const { layouts } = await proposeForOrder(orderId);
  const real = layouts.filter((l) => !l.virtual);
  if (!real.length) fail(back, "ما بيه ألواح بالمخزن تكفي. سجل الألواح أولاً من «القص والألواح».");
  if (old.data?.length) {
    const del = await db.from("cut_plans").delete().in("id", old.data.map((p) => p.id));
    if (del.error) fail(back, dbError(del.error));
    await db.from("plates").update({ status: "available" }).in("id", old.data.map((p) => p.plate_id)).eq("status", "reserved");
  }
  const rows = real.map((l) => ({
    order_id: orderId,
    plate_id: l.plate.id,
    layout: l.placed,
    remnants: l.remnants,
    plate_kg: +l.plate_kg.toFixed(2),
    parts_kg: +l.parts_kg.toFixed(2),
    remnant_kg: +l.remnant_kg.toFixed(2),
    scrap_kg: +l.scrap_kg.toFixed(2),
    price_kg: Number(l.plate.price_kg),
    scrap_price: s.scrapPrice,
  }));
  const { error } = await db.from("cut_plans").insert(rows);
  if (error) fail(back, dbError(error));
  await db.from("plates").update({ status: "reserved" }).in("id", real.map((l) => l.plate.id));
  revalidatePath("/cutting", "layout");
  revalidatePath(`/orders/${orderId}`);
  ok(`/cutting/plans?order=${orderId}`, `انحفظ ${real.length} مخطط وانحجزت الألواح.`);
}

// تم القص: البقايا المختارة ترجع ألواح، والباقي هدر
export async function finishCut(form: FormData) {
  const db = await supabase();
  const id = str(form, "id")!;
  const back = `/cutting/plans/${id}`;
  const { data: plan } = await db.from("cut_plans").select("remnants").eq("id", id).maybeSingle();
  const all = (plan?.remnants as { x: number; y: number; w: number; h: number }[]) ?? [];
  const keep = all.filter((_, i) => form.get(`rem_${i}`) === "on");
  const { error } = await db.rpc("finish_cut", { p_plan: id, p_remnants: keep });
  if (error) fail(back, dbError(error));
  revalidatePath("/cutting", "layout");
  ok(back, "انسجل القص. البقايا رجعت للألواح والهدر انحسب على الأمر.");
}

export async function cancelPlan(form: FormData) {
  const db = await supabase();
  const id = str(form, "id")!;
  const { data: plan } = await db.from("cut_plans").select("plate_id, status").eq("id", id).maybeSingle();
  if (!plan || plan.status !== "draft") fail(`/cutting/plans/${id}`, "المخطط المنفذ ما ينلغي.");
  const { error } = await db.from("cut_plans").delete().eq("id", id);
  if (error) fail(`/cutting/plans/${id}`, dbError(error));
  await db.from("plates").update({ status: "available" }).eq("id", plan!.plate_id).eq("status", "reserved");
  revalidatePath("/cutting", "layout");
  ok("/cutting/plans", "انلغى المخطط ورجع اللوح متوفر.");
}

// ---------- إعدادات القص ----------
export async function saveCutSettings(form: FormData) {
  const db = await supabase();
  const { error } = await db
    .from("settings")
    .update({
      kerf_mm: numOrNull(form, "kerf_mm") ?? 3,
      edge_mm: numOrNull(form, "edge_mm") ?? 10,
      min_remnant_mm: numOrNull(form, "min_remnant_mm") ?? 300,
      scrap_price: numOrNull(form, "scrap_price") ?? 0,
      loss_alert_pct: numOrNull(form, "loss_alert_pct") ?? 20,
      plate_sizes: str(form, "plate_sizes") ?? "6000x1500, 6000x2000",
    })
    .eq("id", 1);
  if (error) fail("/cutting/report", dbError(error));
  revalidatePath("/cutting", "layout");
  ok("/cutting/report", "انحفظت إعدادات القص.");
}
