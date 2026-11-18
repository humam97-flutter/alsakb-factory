"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getMe, can } from "@/lib/auth";
import { mergeCutRates, type CutMachine } from "@/lib/cut-cost";
import { getCutSettings } from "@/lib/cutting";
import { costDrawing, stageNames, type DrawPart } from "@/lib/drawing-cost";
import { mergeRates } from "@/lib/estimate";
import { dbError, fail, str } from "@/lib/form";
import type { Plate } from "@/lib/nesting";
import { addDays, addWorkDays, kindOf, nextWorkDay, type Center } from "@/lib/planning";
import { supabase } from "@/lib/supabase/server";

const back = "/cutting/import";
type Payload = { file: string; sets: number; job: string; grade: string; useStock: boolean; priceKg: number; machine: CutMachine; parts: DrawPart[] };

// حفظ المخطط: نعيد الحساب بالسيرفر بآخر بيانات المخزن، وبعدين تسعيرة و/أو أمر عمل مع القطع والخطة
export async function saveDrawing(form: FormData) {
  const me = await getMe();
  const db = await supabase();
  let d: Payload;
  try {
    d = JSON.parse(str(form, "data") ?? "");
  } catch {
    fail(back, "البيانات ناقصة. ارفع المخطط مرة ثانية.");
  }
  if (!d.parts?.length) fail(back, "ماكو قطع.");
  const to = str(form, "to") ?? "estimate";
  const wantEst = (to === "estimate" || to === "both") && can.finance(me.role);
  const wantOrder = (to === "order" || to === "both") && can.production(me.role);
  if (!wantEst && !wantOrder) fail(back, "ليس لديك صلاحية لهذا الحفظ.");
  const title = str(form, "title") ?? (d.file || "مخطط");
  const customerId = str(form, "customer_id");

  const s = await getCutSettings();
  const [{ data: st }, { data: plates }, { data: centers }, { data: cust }] = await Promise.all([
    db.from("settings").select("est_rates, cut_rates, off_days").eq("id", 1).maybeSingle(),
    db.from("plates").select("id, serial, grade, thickness, length_mm, width_mm, density, price_kg, parent_id, location").eq("status", "available"),
    db.from("work_centers").select("*").eq("active", true).order("position"),
    customerId ? db.from("customers").select("name, phone").eq("id", customerId).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const rates = mergeRates(st?.est_rates);
  const cs = (centers ?? []) as Center[];
  const r = costDrawing({
    parts: d.parts.map((p) => ({ ...p, include: true })),
    sets: d.sets,
    job: d.job,
    useStock: d.useStock,
    plates: (plates ?? []) as Plate[],
    settings: { kerf: s.kerf, edge: s.edge, minRemnant: s.minRemnant, sizes: s.sizes, scrapPrice: s.scrapPrice },
    cut: { ...mergeCutRates(st?.cut_rates), machine: d.machine },
    rates,
    priceKg: Number(d.priceKg) || rates.plate_kg,
    centers: cs,
  });
  const t = r.totals;
  const summary = { sheets: t.sheets, buy: t.buy, yield: t.yield, netKg: t.netKg, scrapKg: t.scrapKg, cutHours: t.cutHours, cutLen: t.cutLen, hours: t.hours, days: t.days, cost: t.cost, price: t.price, stages: r.stages };

  const { data: dr, error } = await db
    .from("drawings")
    .insert({ title, file_name: d.file, customer_id: customerId, job_type: d.job, grade: d.grade, sets: d.sets, parts: d.parts, summary })
    .select("id")
    .single();
  if (error) fail(back, dbError(error));

  const productType = d.job === "cut_only" ? "other" : d.job;
  let estimateId: string | null = null;
  if (wantEst) {
    const { data: e, error: ee } = await db
      .from("estimates")
      .insert({ title, customer_id: customerId, product_type: productType, weight_kg: Math.round(t.netKg * 100) / 100, qty: 1, overhead_pct: rates.overhead_pct, contingency_pct: rates.contingency_pct, margin_pct: rates.margin_pct, notes: `من مخطط DXF: ${d.file} (${d.sets} نسخة، ${t.sheets} لوح، استغلال ${(t.yield * 100).toFixed(1)}%)` })
      .select("id")
      .single();
    if (ee) fail(back, dbError(ee));
    estimateId = e.id;
    await db.from("estimate_lines").insert(r.lines.map((l, i) => ({ estimate_id: e.id, position: i + 1, ...l })));
  }

  let orderId: string | null = null;
  if (wantOrder) {
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Baghdad" });
    const off = ((st?.off_days as number[] | null) ?? [5]).map(Number);
    const { data: o, error: oe } = await db
      .from("work_orders")
      .insert({ product: title, client: cust?.name ?? null, client_phone: cust?.phone ?? null, customer_id: customerId, qty: d.sets, unit: "مجموعة", start_date: today, weight_kg: Math.round(t.netKg * 100) / 100, product_type: productType, notes: `من مخطط DXF: ${d.file}` })
      .select("id")
      .single();
    if (oe) fail(back, dbError(oe));
    orderId = o.id;
    // القطع بأشكالها
    const { error: pe } = await db.from("cut_parts").insert(
      d.parts.map((p) => {
        const round = p.shape === "circle" || p.shape === "ring";
        return {
          order_id: o.id,
          drawing_id: dr.id,
          name: (p.name.includes(p.key) ? p.name : `${p.key} ${p.name}`).slice(0, 120),
          shape: round ? p.shape : "rect",
          grade: p.grade,
          thickness: p.thickness,
          length_mm: round ? null : p.w,
          width_mm: round ? null : p.h,
          diameter_mm: round ? (p.diameter ?? p.w) : null,
          inner_mm: p.shape === "ring" ? (p.inner ?? null) : null,
          qty: Math.max(1, Math.round(p.qty)) * Math.max(1, Math.round(d.sets)),
          geometry: p.shape === "poly" ? p.geom : null,
          area_mm2: p.shape === "poly" ? Math.round(p.area * 10) / 10 : null,
          cut_len_mm: Math.round(p.cutLen * 10) / 10,
          pierces: p.pierces,
        };
      }),
    );
    if (pe) fail(back, dbError(pe));
    // المراحل بالساعات المحسوبة، مجدولة وراء بعض على مراكز العمل
    await db.from("work_order_stages").delete().eq("order_id", o.id);
    const names = stageNames(d.job);
    const hoursOf = new Map(r.stages.map((x) => [x.name, x]));
    const byKind = new Map(cs.map((c) => [c.kind, c]));
    const total = r.stages.reduce((a, x) => a + x.hours, 0) || 1;
    let cursor = nextWorkDay(today, off);
    let end = today;
    const rows = names.map((name, i) => {
      const h = hoursOf.get(name);
      const c = byKind.get(kindOf(name) ?? "") ?? null;
      if (!h) return { order_id: o.id, position: i + 1, name, work_center_id: c?.id ?? null, plan_hours: 0, weight_pct: 0 };
      const start = cursor;
      end = addWorkDays(start, h.days, off);
      cursor = nextWorkDay(addDays(end, 1), off);
      return { order_id: o.id, position: i + 1, name, work_center_id: c?.id ?? null, plan_hours: h.hours, weight_pct: Math.round((h.hours / total) * 1000) / 10, plan_start: start, plan_end: end };
    });
    const { error: se } = await db.from("work_order_stages").insert(rows);
    if (se) fail(back, dbError(se));
    await db.from("work_orders").update({ due_date: addWorkDays(end, 2, off) }).eq("id", o.id);
    if (estimateId) await db.from("estimates").update({ order_id: o.id }).eq("id", estimateId);
  }
  await db.from("drawings").update({ estimate_id: estimateId, order_id: orderId }).eq("id", dr.id);
  revalidatePath(back);
  if (orderId) redirect(`/cutting/order/${orderId}?ok=${encodeURIComponent("انعمل أمر العمل مع القطع والخطة. اقترح مخطط القص من هنا")}`);
  redirect(`/sales/estimates/${estimateId}?ok=${encodeURIComponent("انحفظت التسعيرة من المخطط")}`);
}

// سرعات وأسعار القص
export async function saveCutRates(form: FormData) {
  const db = await supabase();
  const o: Record<string, unknown> = {};
  for (const [k, v] of form.entries()) if (typeof v === "string" && k !== "$ACTION_ID" && !k.startsWith("$")) o[k] = v.trim();
  const { error } = await db.from("settings").update({ cut_rates: mergeCutRates(o) }).eq("id", 1);
  if (error) fail("/cutting/import/rates", dbError(error));
  revalidatePath("/cutting/import");
  redirect("/cutting/import/rates?ok=" + encodeURIComponent("انحفظت"));
}
