"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { api650, ASME_MATERIALS, API650_MATERIALS } from "@/lib/engineering";
import { dbError, fail, str } from "@/lib/form";
import { supabase } from "@/lib/supabase/server";
import { tankInput, vesselInput } from "./inputs";
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
  let parts: Record<string, unknown>[] = [];
  if (kind === "vessel") {
    const { inp, mat } = vesselInput(raw);
    const r = vessel(inp);
    results = { tShell: r.tShell, tHead: r.tHead, mawp: r.mawp, hydro: r.hydro, liters: r.liters, emptyKg: r.emptyKg, blank: r.blank };
    const grade = ASME_MATERIALS[mat]?.grade ?? "A516 Gr70";
    parts = [
      ...r.shellPlates.map((c) => ({ name: `Shell C${c.course}`, shape: "rect", grade, thickness: r.tShell, length_mm: Math.round(Math.max(c.l, c.w)), width_mm: Math.round(Math.min(c.l, c.w)), qty: c.n })),
      ...(inp.head === "flat"
        ? [{ name: "Flat head", shape: "circle", grade, thickness: r.tHead, diameter_mm: Math.round(r.OD), qty: 2 }]
        : [{ name: "Head blank", shape: "circle", grade, thickness: r.tHead, diameter_mm: r.blank, qty: 2 }]),
    ];
  } else if (kind === "tank") {
    const { inp, mat } = tankInput(raw);
    const r = api650(inp);
    results = { courses: r.courses.map((c) => c.t), tBottom: r.tBottom, nominal: r.nominal, totalKg: r.totalKg };
    const grade = API650_MATERIALS[mat]?.grade ?? "A36";
    parts = r.courses.map((c) => ({ name: `Course ${c.course}`, shape: "rect", grade, thickness: c.t, length_mm: Math.round(Math.max(r.pieceL, c.w)), width_mm: Math.round(Math.min(r.pieceL, c.w)), qty: r.perCourse }));
  }

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
