"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { mergeRates, STAGE_SPLIT } from "@/lib/estimate";
import { dbError, fail, numOrNull, str } from "@/lib/form";
import { planOrder, type Center } from "@/lib/planning";
import { supabase } from "@/lib/supabase/server";

type Db = Awaited<ReturnType<typeof supabase>>;

// ---------- مراكز العمل ----------
export async function saveCenter(form: FormData) {
  const db = await supabase();
  const id = str(form, "id");
  const row = {
    code: (str(form, "code") ?? "WC").toUpperCase(),
    name: str(form, "name") ?? "مركز عمل",
    kind: str(form, "kind") ?? "other",
    hours_day: numOrNull(form, "hours_day") ?? 8,
    people: numOrNull(form, "people") ?? 1,
    efficiency: numOrNull(form, "efficiency") ?? 85,
    color: numOrNull(form, "color") ?? 0,
    active: str(form, "active") !== "no",
  };
  const { error } = id ? await db.from("work_centers").update(row).eq("id", id) : await db.from("work_centers").insert(row);
  if (error) fail("/production/centers", dbError(error));
  revalidatePath("/production/centers");
  redirect("/production/centers?ok=" + encodeURIComponent("انحفظ"));
}

export async function deleteCenter(form: FormData) {
  const db = await supabase();
  const { error } = await db.from("work_centers").delete().eq("id", str(form, "id")!);
  if (error) fail("/production/centers", dbError(error));
  revalidatePath("/production/centers");
}

export async function setMachineCenter(form: FormData) {
  const db = await supabase();
  const { error } = await db.from("machines").update({ work_center_id: str(form, "work_center_id") }).eq("id", str(form, "machine_id")!);
  if (error) fail("/production/centers", dbError(error));
  revalidatePath("/production/centers");
}

// ---------- خطة الأمر ----------
async function context(db: Db) {
  const [{ data: centers }, { data: st }] = await Promise.all([
    db.from("work_centers").select("*").eq("active", true).order("position"),
    db.from("settings").select("off_days, est_rates").limit(1).maybeSingle(),
  ]);
  return { centers: (centers ?? []) as Center[], off: ((st?.off_days as number[] | null) ?? [5]).map(Number), rates: mergeRates(st?.est_rates) };
}

// وزن الأمر ونوعه وساعاته من التسعير أو الحساب الهندسي إذا ما مسجلة
async function orderBasis(db: Db, id: string) {
  const [{ data: o }, { data: est }, { data: calc }] = await Promise.all([
    db.from("work_orders").select("id, start_date, weight_kg, product_type, qty").eq("id", id).maybeSingle(),
    db.from("estimates").select("id, weight_kg, qty, product_type").eq("order_id", id).limit(1).maybeSingle(),
    db.from("calcs").select("kind, results").eq("order_id", id).in("kind", ["vessel", "tank"]).limit(1).maybeSingle(),
  ]);
  if (!o) return null;
  let hours: number | null = null;
  if (est) {
    const { data: t } = await db.from("estimate_totals").select("hours").eq("estimate_id", est.id).maybeSingle();
    hours = t?.hours ? Number(t.hours) : null;
  }
  const r = (calc?.results ?? {}) as Record<string, number>;
  const weight = o.weight_kg ?? (est?.weight_kg ? Number(est.weight_kg) * Number(est.qty ?? 1) : null) ?? (r.emptyKg ?? r.totalKg ?? null);
  const type = o.product_type ?? est?.product_type ?? calc?.kind ?? null;
  return { o, weight: weight ? Number(weight) : null, type, hours };
}

async function applyPlan(db: Db, orderId: string, start?: string | null) {
  const basis = await orderBasis(db, orderId);
  if (!basis) return "الأمر غير موجود.";
  const { centers, off, rates } = await context(db);
  const { data: stages } = await db.from("work_order_stages").select("id, name, status, work_center_id, plan_hours, plan_start, plan_end").eq("order_id", orderId).order("position");
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Baghdad" });
  const from = start ?? (basis.o.start_date && basis.o.start_date > today ? basis.o.start_date : today);
  const plan = planOrder({ start: from, weightKg: basis.weight, type: basis.type, estHours: basis.hours }, (stages ?? []) as never, centers, off, rates);
  for (const p of plan) {
    const { error } = await db.from("work_order_stages").update({ work_center_id: p.work_center_id, plan_hours: p.plan_hours, weight_pct: p.weight_pct, plan_start: p.plan_start, plan_end: p.plan_end }).eq("id", p.id);
    if (error) return dbError(error);
  }
  await db.from("work_orders").update({ weight_kg: basis.weight, product_type: basis.type }).eq("id", orderId).is("weight_kg", null);
  return null;
}

export async function autoPlan(form: FormData) {
  const db = await supabase();
  const id = str(form, "order_id")!;
  const back = str(form, "back") ?? `/production/plan/${id}`;
  const err = await applyPlan(db, id, str(form, "start"));
  if (err) fail(back, err);
  revalidatePath(back.split("?")[0]);
  redirect(back + (back.includes("?") ? "&" : "?") + "ok=" + encodeURIComponent("انخططت المراحل"));
}

// يخطط كل الأوامر المفتوحة اللي ما عدها خطة
export async function planAll() {
  const db = await supabase();
  const { data: orders } = await db.from("work_orders").select("id, stages:work_order_stages(plan_start)").in("status", ["new", "in_progress"]);
  let n = 0;
  for (const o of orders ?? []) {
    const st = (o.stages as { plan_start: string | null }[]) ?? [];
    if (st.some((s) => s.plan_start)) continue;
    const err = await applyPlan(db, o.id);
    if (err) fail("/production/gantt", err);
    n++;
  }
  revalidatePath("/production/gantt");
  redirect("/production/gantt?ok=" + encodeURIComponent(n ? `انخطط ${n} أمر` : "كل الأوامر مخططة"));
}

// يبدل مراحل الأمر بالمسار القياسي لنوع المنتج (إذا ما بدأ الشغل)
export async function standardRouting(form: FormData) {
  const db = await supabase();
  const id = str(form, "order_id")!;
  const back = `/production/plan/${id}`;
  const type = str(form, "product_type") ?? "other";
  const { data: stages } = await db.from("work_order_stages").select("id, status").eq("order_id", id);
  if ((stages ?? []).some((s) => s.status !== "waiting")) fail(back, "الشغل بدأ على هذا الأمر. عدّل المراحل يدوياً.");
  const del = await db.from("work_order_stages").delete().eq("order_id", id);
  if (del.error) fail(back, dbError(del.error));
  const names = [...(STAGE_SPLIT[type] ?? STAGE_SPLIT.other).map(([n]) => n), "تسليم"];
  const { error } = await db.from("work_order_stages").insert(names.map((name, i) => ({ order_id: id, position: i + 1, name })));
  if (error) fail(back, dbError(error));
  await db.from("work_orders").update({ product_type: type }).eq("id", id);
  const err = await applyPlan(db, id);
  if (err) fail(back, err);
  revalidatePath(back);
  redirect(back + "?ok=" + encodeURIComponent("انضافت المراحل القياسية وانخططت"));
}

export async function saveOrderBasis(form: FormData) {
  const db = await supabase();
  const id = str(form, "order_id")!;
  const back = `/production/plan/${id}`;
  const { error } = await db.from("work_orders").update({ weight_kg: numOrNull(form, "weight_kg"), product_type: str(form, "product_type"), start_date: str(form, "start_date") ?? undefined }).eq("id", id);
  if (error) fail(back, dbError(error));
  revalidatePath(back);
  redirect(back);
}

export async function saveStagePlan(form: FormData) {
  const db = await supabase();
  const orderId = str(form, "order_id")!;
  const back = `/production/plan/${orderId}`;
  const start = str(form, "plan_start");
  let end = str(form, "plan_end");
  if (start && end && end < start) end = start;
  const { error } = await db.from("work_order_stages").update({
    work_center_id: str(form, "work_center_id"),
    plan_hours: numOrNull(form, "plan_hours"),
    weight_pct: numOrNull(form, "weight_pct"),
    plan_start: start,
    plan_end: end,
  }).eq("id", str(form, "id")!);
  if (error) fail(back, dbError(error));
  revalidatePath(back);
}

// ---------- شاشة الورشة ----------
export async function floorUpdate(form: FormData) {
  const db = await supabase();
  const id = str(form, "stage_id")!;
  const back = str(form, "back") ?? "/floor";
  const act = str(form, "act");
  const { data: s } = await db.from("work_order_stages").select("order_id, status, progress").eq("id", id).maybeSingle();
  if (!s) fail(back, "المرحلة غير موجودة.");
  const progress = Number(s.progress ?? 0);
  const patch =
    act === "start" ? { status: "working" as const, progress: Math.max(progress, 5) }
    : act === "done" ? { status: "done" as const }
    : act === "undo" ? { status: "working" as const, progress: Math.min(progress, 75) }
    : { status: "working" as const, progress: Math.min(100, Math.floor(progress / 25) * 25 + 25) };
  const { error } = await db.from("work_order_stages").update(patch).eq("id", id);
  if (error) fail(back, dbError(error));
  await db.from("work_orders").update({ status: "in_progress" }).eq("id", s.order_id).eq("status", "new");
  revalidatePath(back.split("?")[0]);
  revalidatePath(`/orders/${s.order_id}`);
}
