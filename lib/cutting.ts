import { cache } from "react";
import { countPlaced, nest, parseSizes, type CutSettings, type Part, type Plate } from "./nesting";
import { supabase } from "./supabase/server";

export const SHAPE_LABEL: Record<string, string> = { rect: "مستطيل", circle: "دائرة (قرص)", ring: "حلقة (فلنجة)" };
export const PLATE_STATUS: Record<string, { label: string; tone: "ok" | "warn" | "mut" }> = {
  available: { label: "متوفر", tone: "ok" },
  reserved: { label: "محجوز لمخطط", tone: "warn" },
  cut: { label: "انقص", tone: "mut" },
};
export const GRADES = ["A36", "A283 C", "A516 Gr70", "A516 Gr60", "SA-516 Gr70", "ST37", "ST52", "SS304", "SS316"];

export const getCutSettings = cache(async () => {
  const db = await supabase();
  const { data } = await db.from("settings").select("kerf_mm, edge_mm, min_remnant_mm, scrap_price, plate_sizes, loss_alert_pct").eq("id", 1).maybeSingle();
  const s: CutSettings & { scrapPrice: number; alertPct: number; sizesText: string } = {
    kerf: Number(data?.kerf_mm ?? 3),
    edge: Number(data?.edge_mm ?? 10),
    minRemnant: Number(data?.min_remnant_mm ?? 300),
    sizes: parseSizes(data?.plate_sizes ?? "6000x1500, 6000x2000"),
    scrapPrice: Number(data?.scrap_price ?? 0),
    alertPct: Number(data?.loss_alert_pct ?? 20),
    sizesText: data?.plate_sizes ?? "6000x1500, 6000x2000",
  };
  return s;
});

export const plateKg = (p: { length_mm: number; width_mm: number; thickness: number; density: number }) =>
  (Number(p.length_mm) * Number(p.width_mm) * Number(p.thickness) * Number(p.density)) / 1e6;

// اقتراح مخطط قص لأمر: القطع الباقية (ناقص اللي انقصت أو بمخطط معتمد) على الألواح المتوفرة
export async function proposeForOrder(orderId: string) {
  const db = await supabase();
  const s = await getCutSettings();
  const [{ data: parts }, { data: plans }, { data: plates }] = await Promise.all([
    db.from("cut_parts").select("*").eq("order_id", orderId).order("created_at"),
    db.from("cut_plans").select("id, layout, plate_id, status").eq("order_id", orderId),
    db.from("plates").select("id, serial, grade, thickness, length_mm, width_mm, density, price_kg, parent_id, location, status").neq("status", "cut"),
  ]);
  const drafts = (plans ?? []).filter((p) => p.status === "draft");
  const done = countPlaced((plans ?? []).filter((p) => p.status === "done"));
  const mine = new Set(drafts.map((d) => d.plate_id));
  const remaining: Part[] = (parts ?? [])
    .map((p) => ({ ...p, qty: p.qty - (done.get(p.id) ?? 0) }) as Part)
    .filter((p) => p.qty > 0);
  // اللوح المحجوز لمخطط هذا الأمر نفسه يرجع للمنافسة لأن الاقتراح الجديد يعوّض المسودة
  const pool = (plates ?? []).filter((p) => p.status === "available" || mine.has(p.id)) as Plate[];
  const result = nest(remaining, pool, s);
  return { ...result, parts: parts ?? [], remaining, settings: s, drafts: drafts.length, doneCount: done };
}
