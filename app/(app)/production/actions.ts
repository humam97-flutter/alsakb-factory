"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { QC_ITEMS, addDays, today } from "@/lib/labels";
import { dbError, fail, numOrNull, str } from "@/lib/form";
import { supabase } from "@/lib/supabase/server";

// ساعات تشغيل المرحلة والعامل اللي نفذها
export async function setStageWork(form: FormData) {
  const db = await supabase();
  const orderId = str(form, "order_id")!;
  const { error } = await db
    .from("work_order_stages")
    .update({ hours: numOrNull(form, "hours"), worker_id: str(form, "worker_id"), machine_id: str(form, "machine_id") })
    .eq("id", str(form, "stage_id")!);
  if (error) fail(`/orders/${orderId}`, dbError(error));
  revalidatePath(`/orders/${orderId}`);
}

// ---------- الجودة ----------
export async function saveQuality(form: FormData) {
  const db = await supabase();
  const orderId = str(form, "order_id")!;
  const checks = Object.fromEntries(QC_ITEMS.map((k, i) => [k, form.get(`qc_${i}`) === "on"]));
  const result = str(form, "result") ?? "pass";
  const { error } = await db.from("quality_checks").insert({
    order_id: orderId,
    result,
    checks,
    inspector: str(form, "inspector"),
    note: str(form, "note"),
  });
  if (error) fail(`/orders/${orderId}`, dbError(error));
  // الفحص المقبول يأشر مرحلة «فحص» منجزة
  if (result === "pass") {
    await db.from("work_order_stages").update({ status: "done" }).eq("order_id", orderId).eq("name", "فحص").neq("status", "done");
  }
  revalidatePath(`/orders/${orderId}`);
}

export async function deleteQuality(form: FormData) {
  const db = await supabase();
  const orderId = str(form, "order_id")!;
  const { error } = await db.from("quality_checks").delete().eq("id", str(form, "id")!);
  if (error) fail(`/orders/${orderId}`, dbError(error));
  revalidatePath(`/orders/${orderId}`);
}

// ---------- الهدر ----------
export async function saveScrap(form: FormData) {
  const db = await supabase();
  const back = str(form, "back") ?? "/production/scrap";
  const kg = numOrNull(form, "kg");
  if (!kg || kg <= 0) fail(back, "اكتب وزن الهدر بالكغم.");
  const { error } = await db.from("scrap").insert({
    order_id: str(form, "order_id"),
    machine_id: str(form, "machine_id"),
    material_id: str(form, "material_id"),
    day: str(form, "day") ?? undefined,
    kg,
    reason: str(form, "reason"),
  });
  if (error) fail(back, dbError(error));
  revalidatePath(back);
  redirect(back);
}

export async function deleteScrap(form: FormData) {
  const db = await supabase();
  const back = str(form, "back") ?? "/production/scrap";
  const { error } = await db.from("scrap").delete().eq("id", str(form, "id")!);
  if (error) fail(back, dbError(error));
  revalidatePath(back);
}

// ---------- البقايا ----------
export async function saveOffcut(form: FormData) {
  const db = await supabase();
  const back = "/production/offcuts";
  const material_id = str(form, "material_id");
  const description = str(form, "description");
  if (!material_id && !description) fail(back, "اختر المادة أو اكتب وصف القطعة.");
  const { error } = await db.from("offcuts").insert({
    material_id,
    description,
    thickness: numOrNull(form, "thickness"),
    length_mm: numOrNull(form, "length_mm"),
    width_mm: numOrNull(form, "width_mm"),
    pieces: numOrNull(form, "pieces") ?? 1,
    location: str(form, "location"),
    from_order_id: str(form, "from_order_id"),
  });
  if (error) fail(back, dbError(error));
  revalidatePath(back);
  redirect(back + "?ok=" + encodeURIComponent("انضافت القطعة."));
}

export async function useOffcut(form: FormData) {
  const db = await supabase();
  const back = "/production/offcuts";
  const { error } = await db
    .from("offcuts")
    .update({ used_order_id: str(form, "order_id"), used_at: today() })
    .eq("id", str(form, "id")!);
  if (error) fail(back, dbError(error));
  revalidatePath(back);
}

export async function deleteOffcut(form: FormData) {
  const db = await supabase();
  const { error } = await db.from("offcuts").delete().eq("id", str(form, "id")!);
  if (error) fail("/production/offcuts", dbError(error));
  revalidatePath("/production/offcuts");
}

// ---------- الصيانة الدورية ----------
export async function savePlan(form: FormData) {
  const db = await supabase();
  const back = "/maintenance";
  const machine_id = str(form, "machine_id");
  const task = str(form, "task");
  const every = numOrNull(form, "every_days");
  if (!machine_id || !task || !every) fail(back, "اختر الماكنة واكتب الشغلة وكل كم يوم.");
  const last = str(form, "last_done");
  const { error } = await db.from("maintenance_plans").insert({
    machine_id,
    task,
    every_days: every,
    last_done: last,
    next_due: last ? addDays(last, every) : today(),
    notes: str(form, "notes"),
  });
  if (error) fail(back, dbError(error));
  revalidatePath(back);
  redirect(back + "?ok=" + encodeURIComponent("انضافت خطة الصيانة."));
}

// إنجاز صيانة دورية: يسجلها بسجل الصيانة ويحسب الموعد الجاي
export async function donePlan(form: FormData) {
  const db = await supabase();
  const id = str(form, "id")!;
  const { data: p } = await db.from("maintenance_plans").select("*, machine:machines(name)").eq("id", id).single();
  if (!p) fail("/maintenance", "الخطة غير موجودة.");
  const d = today();
  const { error } = await db.from("maintenance").insert({
    machine_id: p.machine_id,
    kind: "periodic",
    state: "done",
    day: d,
    done_by: str(form, "done_by"),
    cost: numOrNull(form, "cost"),
    description: p.task,
  });
  if (error) fail("/maintenance", dbError(error));
  await db.from("maintenance_plans").update({ last_done: d, next_due: addDays(d, p.every_days) }).eq("id", id);
  revalidatePath("/maintenance");
  redirect("/maintenance?ok=" + encodeURIComponent(`انسجلت: ${p.task}`));
}

export async function deletePlan(form: FormData) {
  const db = await supabase();
  const { error } = await db.from("maintenance_plans").delete().eq("id", str(form, "id")!);
  if (error) fail("/maintenance", dbError(error));
  revalidatePath("/maintenance");
}

// ---------- قطع الغيار ----------
export async function issuePart(form: FormData) {
  const db = await supabase();
  const id = str(form, "maintenance_id")!;
  const back = `/maintenance/${id}`;
  const material = str(form, "material_id");
  const qty = numOrNull(form, "qty");
  if (!material || !qty) fail(back, "اختر القطعة واكتب الكمية.");
  const { error } = await db.rpc("issue_part", { p_maintenance: id, p_material: material, p_qty: qty });
  if (error) fail(back, error.message);
  revalidatePath(back);
  revalidatePath("/stock");
  redirect(back);
}
