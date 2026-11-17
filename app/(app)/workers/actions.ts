"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { can, getMe } from "@/lib/auth";
import { dbError, fail, list, numOr0, str } from "@/lib/form";
import { supabase } from "@/lib/supabase/server";

export async function saveWorker(form: FormData) {
  const me = await getMe();
  const db = await supabase();
  const id = str(form, "id");
  const back = id ? `/workers/${id}` : "/workers/new";
  const full_name = str(form, "full_name");
  if (!full_name) fail(back, "اكتب اسم العامل.");
  let workerId = id;
  if (can.production(me.role)) {
    const row = {
      full_name,
      job: str(form, "job"),
      phone: str(form, "phone"),
      skills: list(form, "skills"),
      active: form.get("active") !== "no",
      notes: str(form, "notes"),
    };
    const res = id
      ? await db.from("workers").update(row).eq("id", id).select("id").single()
      : await db.from("workers").insert(row).select("id").single();
    if (res.error) fail(back, dbError(res.error));
    workerId = res.data.id;
  }
  if (can.finance(me.role) && workerId) {
    const { error } = await db
      .from("worker_wages")
      .upsert({ worker_id: workerId, daily_wage: numOr0(form, "daily_wage"), currency: str(form, "currency") ?? "IQD" });
    if (error) fail(`/workers/${workerId}`, dbError(error));
  }
  revalidatePath("/workers");
  redirect("/workers");
}

export async function markAttendance(form: FormData) {
  const db = await supabase();
  const day = str(form, "day")!;
  const worker_id = str(form, "worker_id");
  const status = str(form, "status")!;
  if (worker_id) {
    const { error } = await db.from("attendance").upsert({ worker_id, day, status });
    if (error) fail(`/workers?day=${day}`, dbError(error));
  } else {
    // «الكل حاضر» يعلّم فقط من لم يُسجل بعد
    const [{ data: ws }, { data: marked }] = await Promise.all([
      db.from("workers").select("id").eq("active", true),
      db.from("attendance").select("worker_id").eq("day", day),
    ]);
    const done = new Set((marked ?? []).map((m) => m.worker_id));
    const rows = (ws ?? []).filter((w) => !done.has(w.id)).map((w) => ({ worker_id: w.id, day, status: "present" }));
    if (rows.length) {
      const { error } = await db.from("attendance").insert(rows);
      if (error) fail(`/workers?day=${day}`, dbError(error));
    }
  }
  revalidatePath("/workers");
}

export async function setOvertime(form: FormData) {
  const db = await supabase();
  const day = str(form, "day")!;
  const { error } = await db
    .from("attendance")
    .update({ overtime_hours: numOr0(form, "overtime_hours") })
    .eq("worker_id", str(form, "worker_id")!)
    .eq("day", day);
  if (error) fail(`/workers?day=${day}`, dbError(error));
  revalidatePath("/workers");
}

export async function savePayment(form: FormData) {
  const db = await supabase();
  const month = str(form, "month") ?? "";
  const back = `/payroll?month=${month}`;
  const worker_id = str(form, "worker_id");
  const amount = numOr0(form, "amount");
  if (!worker_id || amount <= 0) fail(back, "اختر العامل واكتب المبلغ.");
  const { error } = await db.from("worker_payments").insert({
    worker_id,
    kind: str(form, "kind") ?? "advance",
    amount,
    currency: str(form, "currency") ?? "IQD",
    day: str(form, "day") ?? undefined,
    note: str(form, "note"),
  });
  if (error) fail(back, dbError(error));
  revalidatePath("/payroll");
  redirect(back);
}

export async function deletePayment(form: FormData) {
  const db = await supabase();
  const month = str(form, "month") ?? "";
  const { error } = await db.from("worker_payments").delete().eq("id", str(form, "id")!);
  if (error) fail(`/payroll?month=${month}`, dbError(error));
  revalidatePath("/payroll");
}
