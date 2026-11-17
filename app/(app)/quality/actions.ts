"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { dbError, fail, list, numOr0, numOrNull, str } from "@/lib/form";
import { supabase } from "@/lib/supabase/server";

const back = (f: FormData, d: string) => str(f, "back") ?? d;
const done = (path: string) => {
  revalidatePath(path.split("?")[0].split("#")[0]);
  redirect(path);
};

// ---------- WPS ----------
export async function saveWps(form: FormData) {
  const db = await supabase();
  const id = str(form, "id");
  const row = {
    code: str(form, "code") ?? "WPS",
    process: str(form, "process") ?? "SMAW",
    base_metal: str(form, "base_metal"),
    thickness_range: str(form, "thickness_range"),
    filler: str(form, "filler"),
    positions: str(form, "positions"),
    pqr_no: str(form, "pqr_no"),
    notes: str(form, "notes"),
    active: str(form, "active") !== "no",
  };
  const { error } = id ? await db.from("wps").update(row).eq("id", id) : await db.from("wps").insert(row);
  if (error) fail("/quality/wps", dbError(error));
  done("/quality/wps");
}

export async function deleteWps(form: FormData) {
  const db = await supabase();
  const { error } = await db.from("wps").delete().eq("id", str(form, "id")!);
  if (error) fail("/quality/wps", dbError(error));
  revalidatePath("/quality/wps");
}

// ---------- اللحامين ----------
export async function setStamp(form: FormData) {
  const db = await supabase();
  const { error } = await db.from("workers").update({ welder_stamp: str(form, "welder_stamp") }).eq("id", str(form, "worker_id")!);
  if (error) fail("/quality", dbError(error));
  revalidatePath("/quality");
}

export async function saveQual(form: FormData) {
  const db = await supabase();
  if (!str(form, "worker_id")) fail("/quality", "اختار اللحام.");
  const { error } = await db.from("welder_quals").insert({
    worker_id: str(form, "worker_id"),
    wps_id: str(form, "wps_id"),
    process: str(form, "process") ?? "SMAW",
    positions: str(form, "positions"),
    thickness_range: str(form, "thickness_range"),
    cert_no: str(form, "cert_no"),
    issued_on: str(form, "issued_on"),
    expires_on: str(form, "expires_on"),
    notes: str(form, "notes"),
  });
  if (error) fail("/quality", dbError(error));
  done("/quality?ok=" + encodeURIComponent("انضاف المؤهل."));
}

export async function deleteQual(form: FormData) {
  const db = await supabase();
  const { error } = await db.from("welder_quals").delete().eq("id", str(form, "id")!);
  if (error) fail("/quality", dbError(error));
  revalidatePath("/quality");
}

// ---------- NCR ----------
export async function saveNcr(form: FormData) {
  const db = await supabase();
  const id = str(form, "id");
  const b = back(form, "/quality/ncr");
  const description = str(form, "description");
  if (!description) fail(b, "اكتب وصف المشكلة.");
  const status = str(form, "status") ?? "open";
  const row = {
    order_id: str(form, "order_id"),
    day: str(form, "day") ?? undefined,
    source: str(form, "source") ?? "internal",
    description,
    cause: str(form, "cause"),
    action: str(form, "action"),
    cost: numOr0(form, "cost"),
    status,
    closed_on: status === "closed" ? (str(form, "closed_on") ?? new Date().toISOString().slice(0, 10)) : null,
  };
  const { error } = id ? await db.from("ncrs").update(row).eq("id", id) : await db.from("ncrs").insert(row);
  if (error) fail(b, dbError(error));
  revalidatePath("/quality/ncr");
  done(b);
}

export async function deleteNcr(form: FormData) {
  const db = await supabase();
  const b = back(form, "/quality/ncr");
  const { error } = await db.from("ncrs").delete().eq("id", str(form, "id")!);
  if (error) fail(b, dbError(error));
  revalidatePath(b.split("?")[0]);
}

// ---------- خريطة اللحامات ----------
export async function saveWeld(form: FormData) {
  const db = await supabase();
  const orderId = str(form, "order_id")!;
  const b = `/orders/${orderId}/qa`;
  const kind = str(form, "kind") ?? "long";
  let code = str(form, "code");
  const count = Math.max(1, Math.min(50, Math.floor(numOrNull(form, "count") ?? 1)));
  const { data: existing } = await db.from("welds").select("code").eq("order_id", orderId);
  const used = new Set((existing ?? []).map((w) => w.code));
  const prefix = { long: "L", circ: "C", nozzle: "N", fillet: "F", other: "W" }[kind] ?? "W";
  const rows = [];
  for (let i = 0; i < count; i++) {
    let c = count === 1 && code ? code : "";
    if (!c) {
      let n = 1;
      while (used.has(`${prefix}${n}`)) n++;
      c = `${prefix}${n}`;
    }
    used.add(c);
    rows.push({
      order_id: orderId,
      code: c,
      kind,
      description: str(form, "description"),
      wps_id: str(form, "wps_id"),
      welder_id: str(form, "welder_id"),
      thickness: numOrNull(form, "thickness"),
      length_mm: numOrNull(form, "length_mm"),
      ndt: list(form, "ndt"),
    });
    code = null;
  }
  const { error } = await db.from("welds").insert(rows);
  if (error) fail(b, dbError(error));
  done(b + "#welds");
}

export async function updateWeld(form: FormData) {
  const db = await supabase();
  const orderId = str(form, "order_id")!;
  const b = `/orders/${orderId}/qa`;
  const status = str(form, "status") ?? "pending";
  const { error } = await db
    .from("welds")
    .update({
      welder_id: str(form, "welder_id"),
      wps_id: str(form, "wps_id"),
      status,
      done_on: status === "pending" ? null : (str(form, "done_on") ?? new Date().toISOString().slice(0, 10)),
    })
    .eq("id", str(form, "id")!);
  if (error) fail(b, dbError(error));
  // آخر استخدام للمؤهل يتحدث مع كل لحامة
  if (status !== "pending" && str(form, "welder_id")) {
    await db.from("welder_quals").update({ last_used_on: new Date().toISOString().slice(0, 10) }).eq("worker_id", str(form, "welder_id")!);
  }
  revalidatePath(b);
}

export async function deleteWeld(form: FormData) {
  const db = await supabase();
  const orderId = str(form, "order_id")!;
  const { error } = await db.from("welds").delete().eq("id", str(form, "id")!);
  if (error) fail(`/orders/${orderId}/qa`, dbError(error));
  revalidatePath(`/orders/${orderId}/qa`);
}

// ---------- الفحوصات ----------
export async function saveNdt(form: FormData) {
  const db = await supabase();
  const orderId = str(form, "order_id")!;
  const b = `/orders/${orderId}/qa`;
  const weldIds = list(form, "weld_ids");
  const result = str(form, "result") ?? "accept";
  const { error } = await db.from("ndt_reports").insert({
    order_id: orderId,
    method: str(form, "method") ?? "RT",
    report_no: str(form, "report_no"),
    day: str(form, "day") ?? undefined,
    agency: str(form, "agency"),
    inspector: str(form, "inspector"),
    extent: str(form, "extent"),
    weld_ids: weldIds,
    result,
    notes: str(form, "notes"),
  });
  if (error) fail(b, dbError(error));
  // نتيجة الفحص تنعكس على اللحامات المشمولة
  if (weldIds.length) await db.from("welds").update({ status: result === "accept" ? "accepted" : "repair" }).in("id", weldIds);
  done(b + "#ndt");
}

export async function deleteNdt(form: FormData) {
  const db = await supabase();
  const orderId = str(form, "order_id")!;
  const { error } = await db.from("ndt_reports").delete().eq("id", str(form, "id")!);
  if (error) fail(`/orders/${orderId}/qa`, dbError(error));
  revalidatePath(`/orders/${orderId}/qa`);
}

export async function saveHydro(form: FormData) {
  const db = await supabase();
  const orderId = str(form, "order_id")!;
  const b = `/orders/${orderId}/qa`;
  const test = numOrNull(form, "test_bar");
  if (!test) fail(b, "اكتب ضغط الاختبار.");
  const result = str(form, "result") ?? "pass";
  const { error } = await db.from("hydro_tests").insert({
    order_id: orderId,
    day: str(form, "day") ?? undefined,
    design_bar: numOrNull(form, "design_bar"),
    test_bar: test,
    hold_min: numOrNull(form, "hold_min") ?? 30,
    medium: str(form, "medium") ?? "ماي",
    temp_c: numOrNull(form, "temp_c"),
    gauge_no: str(form, "gauge_no"),
    gauge_cal_due: str(form, "gauge_cal_due"),
    witness: str(form, "witness"),
    result,
    notes: str(form, "notes"),
  });
  if (error) fail(b, dbError(error));
  if (result === "pass") {
    await db.from("work_order_stages").update({ status: "done" }).eq("order_id", orderId).eq("name", "فحص").neq("status", "done");
  }
  done(b + "#hydro");
}

export async function deleteHydro(form: FormData) {
  const db = await supabase();
  const orderId = str(form, "order_id")!;
  const { error } = await db.from("hydro_tests").delete().eq("id", str(form, "id")!);
  if (error) fail(`/orders/${orderId}/qa`, dbError(error));
  revalidatePath(`/orders/${orderId}/qa`);
}

// مرفقات الجودة (تقرير فحص، صور المانوميتر، شهادة مصنع...) بملفات الأمر
export async function addQualityFiles(orderId: string, category: string, refId: string | null, files: { path: string; name: string; size: number; mime: string }[]) {
  const db = await supabase();
  const { error } = await db
    .from("order_files")
    .insert(files.map((f) => ({ order_id: orderId, path: f.path, name: f.name, size: f.size, mime: f.mime || null, category, ref_id: refId })));
  if (error) {
    await db.storage.from("orders").remove(files.map((f) => f.path));
    return { error: dbError(error) };
  }
  revalidatePath(`/orders/${orderId}/qa`);
  return { error: null };
}
