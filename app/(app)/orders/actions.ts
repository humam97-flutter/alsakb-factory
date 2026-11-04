"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { can, getMe } from "@/lib/auth";
import { dbError, fail, list, numOr0, numOrNull, str } from "@/lib/form";
import { supabase } from "@/lib/supabase/server";

export async function saveOrder(form: FormData) {
  const me = await getMe();
  const db = await supabase();
  const id = str(form, "id");
  const back = id ? `/orders/${id}/edit` : "/orders/new";
  const product = str(form, "product");
  if (!product) fail(back, "اكتب اسم المنتج.");

  const row = {
    client: str(form, "client"),
    client_phone: str(form, "client_phone"),
    product,
    qty: numOrNull(form, "qty"),
    unit: str(form, "unit"),
    status: str(form, "status") ?? "new",
    priority: str(form, "priority") ?? "normal",
    start_date: str(form, "start_date"),
    due_date: str(form, "due_date"),
    owner_id: str(form, "owner_id"),
    machines: list(form, "machines"),
    notes: str(form, "notes"),
  };
  const res = id
    ? await db.from("work_orders").update(row).eq("id", id).select("id").single()
    : await db.from("work_orders").insert(row).select("id").single();
  if (res.error) fail(back, dbError(res.error));
  const orderId = res.data.id as string;

  if (can.finance(me.role)) {
    const fin = await db.from("work_order_finance").upsert({
      order_id: orderId,
      price: numOrNull(form, "price"),
      paid: numOr0(form, "paid"),
      cost_labor: numOr0(form, "cost_labor"),
      cost_machine: numOr0(form, "cost_machine"),
      cost_other: numOr0(form, "cost_other"),
      currency: str(form, "currency") ?? "IQD",
    });
    if (fin.error) fail(`/orders/${orderId}/edit`, dbError(fin.error));
  }
  revalidatePath("/orders");
  redirect(`/orders/${orderId}`);
}

export async function deleteOrder(form: FormData) {
  const db = await supabase();
  const id = str(form, "id")!;
  if (form.get("confirm") !== "yes") fail(`/orders/${id}/edit`, "علّم مربع التأكيد قبل الحذف.");
  const { error } = await db.from("work_orders").delete().eq("id", id);
  if (error) fail(`/orders/${id}/edit`, dbError(error));
  revalidatePath("/orders");
  redirect("/orders");
}

export async function setStage(form: FormData) {
  const db = await supabase();
  const orderId = str(form, "order_id")!;
  const { error } = await db
    .from("work_order_stages")
    .update({ status: str(form, "status") })
    .eq("id", str(form, "stage_id")!);
  if (error) fail(`/orders/${orderId}`, dbError(error));
  // أول مرحلة تبدأ تنقل الأمر إلى «قيد التنفيذ»
  if (str(form, "status") !== "waiting") {
    await db.from("work_orders").update({ status: "in_progress" }).eq("id", orderId).eq("status", "new");
  }
  revalidatePath(`/orders/${orderId}`);
}

export async function addStage(form: FormData) {
  const db = await supabase();
  const orderId = str(form, "order_id")!;
  const name = str(form, "name");
  if (!name) fail(`/orders/${orderId}`, "اكتب اسم المرحلة.");
  const { data: last } = await db
    .from("work_order_stages")
    .select("position")
    .eq("order_id", orderId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await db
    .from("work_order_stages")
    .insert({ order_id: orderId, name, position: (last?.position ?? 0) + 1, machine_id: str(form, "machine_id") });
  if (error) fail(`/orders/${orderId}`, dbError(error));
  revalidatePath(`/orders/${orderId}`);
}

export async function deleteStage(form: FormData) {
  const db = await supabase();
  const orderId = str(form, "order_id")!;
  const { error } = await db.from("work_order_stages").delete().eq("id", str(form, "stage_id")!);
  if (error) fail(`/orders/${orderId}`, dbError(error));
  revalidatePath(`/orders/${orderId}`);
}
