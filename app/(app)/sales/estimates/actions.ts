"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ensureCustomer } from "@/lib/customers";
import { ASME_MATERIALS, API650_MATERIALS } from "@/lib/engineering";
import { buildLines, DEFAULT_RATES, mergeRates, type Rates, type Source } from "@/lib/estimate";
import { dbError, fail, numOr0, numOrNull, str } from "@/lib/form";
import { supabase } from "@/lib/supabase/server";
import { tankInput, vesselInput } from "../../tools/engineering/inputs";

type DB = Awaited<ReturnType<typeof supabase>>;

async function getRates(db: DB) {
  const { data } = await db.from("settings").select("est_rates").eq("id", 1).maybeSingle();
  return mergeRates(data?.est_rates);
}

// متوسط هدر القص الفعلي آخر 6 أشهر إذا متوفر، حتى التقدير يمشي على واقع المعمل
async function actualWaste(db: DB) {
  const since = new Date(Date.now() - 183 * 864e5).toISOString().slice(0, 10);
  const { data } = await db.from("cut_loss_monthly").select("plate_kg, scrap_kg").gte("month", since);
  const p = (data ?? []).reduce((a, r) => a + Number(r.plate_kg), 0);
  const s = (data ?? []).reduce((a, r) => a + Number(r.scrap_kg), 0);
  return p > 2000 ? Math.round((s / p) * 1000) / 10 : null;
}

async function sourceOf(db: DB, e: { calc_id: string | null; product_type: string; weight_kg: number | null; notes?: string | null }, plates: boolean): Promise<Source | null> {
  if (e.calc_id) {
    const { data: c } = await db.from("calcs").select("kind, inputs").eq("id", e.calc_id).maybeSingle();
    const raw = (c?.inputs ?? {}) as Record<string, string>;
    if (c?.kind === "vessel") {
      const { inp, mat } = vesselInput(raw);
      return { kind: "vessel", inp, grade: ASME_MATERIALS[mat]?.label ?? mat, joint: raw.joint ?? "spot" };
    }
    if (c?.kind === "tank") {
      const { inp, mat } = tankInput(raw);
      return { kind: "tank", inp, grade: API650_MATERIALS[mat]?.label ?? mat };
    }
  }
  if (e.weight_kg && Number(e.weight_kg) > 0) return { kind: "weight", type: e.product_type, kg: Number(e.weight_kg), plates };
  return null;
}

async function writeLines(db: DB, id: string, src: Source, rates: Rates) {
  const { lines, weightKg } = buildLines(src, rates);
  await db.from("estimate_lines").delete().eq("estimate_id", id);
  const { error } = await db.from("estimate_lines").insert(lines.map((l, i) => ({ ...l, estimate_id: id, position: i + 1 })));
  if (error) return error;
  await db.from("estimates").update({ weight_kg: weightKg }).eq("id", id);
  return null;
}

export async function createEstimate(form: FormData) {
  const db = await supabase();
  const back = "/sales/estimates/new";
  const calcId = str(form, "calc_id");
  const kg = numOrNull(form, "weight_kg");
  if (!calcId && !(kg && kg > 0)) fail(back, "اختار حساب هندسي محفوظ أو اكتب الوزن التقريبي.");
  const rates = await getRates(db);
  const waste = await actualWaste(db);
  if (waste !== null && form.get("use_actual") === "on") rates.waste_pct = waste;
  let type = str(form, "product_type") ?? "vessel";
  if (calcId) {
    const { data: c } = await db.from("calcs").select("kind").eq("id", calcId).maybeSingle();
    if (c?.kind === "vessel" || c?.kind === "tank") type = c.kind;
  }
  const customer_id = str(form, "customer_id") ?? (await ensureCustomer(db, str(form, "new_customer"), null));
  const { data: e, error } = await db
    .from("estimates")
    .insert({
      title: str(form, "title") ?? "تقدير",
      customer_id,
      product_type: type,
      calc_id: calcId,
      weight_kg: calcId ? null : kg,
      qty: Math.max(1, Math.floor(numOrNull(form, "qty") ?? 1)),
      currency: str(form, "currency") ?? "IQD",
      overhead_pct: rates.overhead_pct,
      contingency_pct: rates.contingency_pct,
      margin_pct: rates.margin_pct,
      notes: [str(form, "notes"), waste !== null && form.get("use_actual") === "on" ? `الهدر محسوب على متوسط المعمل الفعلي ${waste}%` : null].filter(Boolean).join("\n") || null,
    })
    .select("*")
    .single();
  if (error) fail(back, dbError(error));
  const src = await sourceOf(db, e, form.get("plates") === "on");
  if (src) {
    const err = await writeLines(db, e.id, src, rates);
    if (err) fail(`/sales/estimates/${e.id}`, dbError(err));
  }
  revalidatePath("/sales/estimates");
  redirect(`/sales/estimates/${e.id}`);
}

export async function saveEstimate(form: FormData) {
  const db = await supabase();
  const id = str(form, "id")!;
  const back = `/sales/estimates/${id}`;
  const { error } = await db
    .from("estimates")
    .update({
      title: str(form, "title") ?? "تقدير",
      qty: Math.max(1, Math.floor(numOrNull(form, "qty") ?? 1)),
      overhead_pct: numOr0(form, "overhead_pct"),
      contingency_pct: numOr0(form, "contingency_pct"),
      margin_pct: numOr0(form, "margin_pct"),
      status: str(form, "status") ?? "draft",
      currency: str(form, "currency") ?? "IQD",
      notes: str(form, "notes"),
    })
    .eq("id", id);
  if (error) fail(back, dbError(error));
  revalidatePath(back);
  redirect(`${back}?ok=${encodeURIComponent("انحفظ.")}`);
}

export async function regenerate(form: FormData) {
  const db = await supabase();
  const id = str(form, "id")!;
  const back = `/sales/estimates/${id}`;
  const { data: e } = await db.from("estimates").select("*").eq("id", id).single();
  const src = e ? await sourceOf(db, e, true) : null;
  if (!src) fail(back, "ما بيه حساب أو وزن نولد منه البنود.");
  const err = await writeLines(db, id, src!, await getRates(db));
  if (err) fail(back, dbError(err));
  revalidatePath(back);
  redirect(`${back}?ok=${encodeURIComponent("انولدت البنود من جديد بالأسعار الحالية.")}`);
}

export async function addEstLine(form: FormData) {
  const db = await supabase();
  const id = str(form, "estimate_id")!;
  const back = `/sales/estimates/${id}`;
  const description = str(form, "description");
  if (!description) fail(back, "اكتب وصف البند.");
  const { data: last } = await db.from("estimate_lines").select("position").eq("estimate_id", id).order("position", { ascending: false }).limit(1).maybeSingle();
  const { error } = await db.from("estimate_lines").insert({
    estimate_id: id,
    position: (last?.position ?? 0) + 1,
    category: str(form, "category") ?? "other",
    description,
    qty: numOrNull(form, "qty") ?? 1,
    unit: str(form, "unit"),
    unit_cost: numOr0(form, "unit_cost"),
  });
  if (error) fail(back, dbError(error));
  revalidatePath(back);
}

export async function updateEstLine(form: FormData) {
  const db = await supabase();
  const id = str(form, "estimate_id")!;
  const { error } = await db.from("estimate_lines").update({ qty: numOrNull(form, "qty") ?? 0, unit_cost: numOr0(form, "unit_cost") }).eq("id", str(form, "line_id")!);
  if (error) fail(`/sales/estimates/${id}`, dbError(error));
  revalidatePath(`/sales/estimates/${id}`);
}

export async function deleteEstLine(form: FormData) {
  const db = await supabase();
  const id = str(form, "estimate_id")!;
  const { error } = await db.from("estimate_lines").delete().eq("id", str(form, "line_id")!);
  if (error) fail(`/sales/estimates/${id}`, dbError(error));
  revalidatePath(`/sales/estimates/${id}`);
}

export async function deleteEstimate(form: FormData) {
  const db = await supabase();
  const id = str(form, "id")!;
  const { error } = await db.from("estimates").delete().eq("id", id);
  if (error) fail(`/sales/estimates/${id}`, dbError(error));
  revalidatePath("/sales/estimates");
  redirect("/sales/estimates");
}

// التقدير يصير عرض سعر للزبون: سطر واحد بالسعر النهائي
export async function estimateToQuote(form: FormData) {
  const db = await supabase();
  const id = str(form, "id")!;
  const back = `/sales/estimates/${id}`;
  const [{ data: e }, { data: t }] = await Promise.all([
    db.from("estimates").select("*").eq("id", id).single(),
    db.from("estimate_totals").select("price").eq("estimate_id", id).single(),
  ]);
  if (!e || !t) fail(back, "التقدير غير موجود.");
  if (e!.quote_id) redirect(`/sales/quotes/${e!.quote_id}`);
  const valid = new Date(Date.now() + 15 * 864e5).toISOString().slice(0, 10);
  const { data: q, error } = await db
    .from("quotes")
    .insert({ customer_id: e!.customer_id, currency: e!.currency, valid_until: valid, notes: `من التقدير #${e!.no}` })
    .select("id")
    .single();
  if (error) fail(back, dbError(error));
  const unit = Math.round(Number(t!.price) / e!.qty / 1000) * 1000;
  await db.from("quote_lines").insert({ quote_id: q!.id, position: 1, description: e!.title, qty: e!.qty, unit: e!.qty > 1 ? "قطعة" : "مقطوع", unit_price: unit });
  await db.from("estimates").update({ quote_id: q!.id, status: "quoted" }).eq("id", id);
  revalidatePath("/sales/quotes");
  redirect(`/sales/quotes/${q!.id}`);
}

export async function saveRates(form: FormData) {
  const db = await supabase();
  const r: Record<string, number> = {};
  for (const k of Object.keys(DEFAULT_RATES)) {
    const v = numOrNull(form, k);
    if (v !== null && Number.isFinite(v)) r[k] = v;
  }
  const { error } = await db.from("settings").update({ est_rates: r }).eq("id", 1);
  if (error) fail("/sales/estimates/rates", dbError(error));
  revalidatePath("/sales/estimates", "layout");
  redirect("/sales/estimates/rates?ok=" + encodeURIComponent("انحفظت الأسعار. التقديرات الجديدة تمشي عليها."));
}
