"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getMe } from "@/lib/auth";
import { dbError, fail, numOr0, numOrNull, str } from "@/lib/form";
import { supabase } from "@/lib/supabase/server";

// ---------- الموردين ----------
export async function saveSupplier(form: FormData) {
  const db = await supabase();
  const id = str(form, "id");
  const back = id ? `/purchases/suppliers/${id}?edit=1` : "/purchases/suppliers/new";
  const name = str(form, "name");
  if (!name) fail(back, "اكتب اسم المورد.");
  const row = {
    name,
    phone: str(form, "phone"),
    address: str(form, "address"),
    supplies: str(form, "supplies"),
    notes: str(form, "notes"),
    active: str(form, "active") !== "no",
  };
  const res = id
    ? await db.from("suppliers").update(row).eq("id", id).select("id").single()
    : await db.from("suppliers").insert(row).select("id").single();
  if (res.error) fail(back, dbError(res.error));
  revalidatePath("/purchases/suppliers");
  redirect(`/purchases/suppliers/${res.data.id}`);
}

// ---------- طلبات الشراء ----------
export async function saveRequest(form: FormData) {
  const db = await supabase();
  const back = "/purchases/requests";
  const material_id = str(form, "material_id");
  let description = str(form, "description");
  if (!description && material_id) {
    const { data: m } = await db.from("materials").select("name, spec").eq("id", material_id).single();
    description = m ? [m.name, m.spec].filter(Boolean).join(" ") : null;
  }
  if (!description) fail(back, "اختر المادة أو اكتب شنو تحتاج.");
  const { error } = await db.from("purchase_requests").insert({
    material_id,
    description,
    qty: numOrNull(form, "qty"),
    unit: str(form, "unit"),
    needed_by: str(form, "needed_by"),
    supplier_id: str(form, "supplier_id"),
    note: str(form, "note"),
  });
  if (error) fail(back, dbError(error));
  revalidatePath(back);
  redirect(back + "?ok=" + encodeURIComponent("انرفع الطلب."));
}

export async function setRequestStatus(form: FormData) {
  const db = await supabase();
  const { error } = await db.from("purchase_requests").update({ status: str(form, "status") }).eq("id", str(form, "id")!);
  if (error) fail("/purchases/requests", dbError(error));
  revalidatePath("/purchases/requests");
}

export async function deleteRequest(form: FormData) {
  const db = await supabase();
  const { error } = await db.from("purchase_requests").delete().eq("id", str(form, "id")!);
  if (error) fail("/purchases/requests", dbError(error));
  revalidatePath("/purchases/requests");
}

// ---------- فواتير الشراء ----------
export async function savePurchase(form: FormData) {
  const db = await supabase();
  const id = str(form, "id");
  const back = id ? `/purchases/invoices/${id}?edit=1` : "/purchases/invoices/new";
  let supplier_id = str(form, "supplier_id");
  const newName = str(form, "new_supplier");
  if (!supplier_id && newName) {
    const { data: s, error } = await db.from("suppliers").insert({ name: newName, phone: str(form, "new_phone") }).select("id").single();
    if (error) fail(back, dbError(error));
    supplier_id = s.id;
  }
  if (!supplier_id) fail(back, "اختر المورد أو اكتب اسم مورد جديد.");
  const row = {
    supplier_id,
    supplier_ref: str(form, "supplier_ref"),
    day: str(form, "day") ?? undefined,
    due_date: str(form, "due_date"),
    currency: str(form, "currency") ?? "IQD",
    discount: numOr0(form, "discount"),
    notes: str(form, "notes"),
  };
  const res = id
    ? await db.from("purchase_invoices").update(row).eq("id", id).select("id").single()
    : await db.from("purchase_invoices").insert(row).select("id").single();
  if (res.error) fail(back, dbError(res.error));
  revalidatePath("/purchases/invoices");
  redirect(`/purchases/invoices/${res.data.id}`);
}

export async function addPurchaseLine(form: FormData) {
  const db = await supabase();
  const invoiceId = str(form, "invoice_id")!;
  const back = `/purchases/invoices/${invoiceId}`;
  const material_id = str(form, "material_id");
  let description = str(form, "description");
  let unit = str(form, "unit");
  if (material_id) {
    const { data: m } = await db.from("materials").select("name, spec, unit").eq("id", material_id).single();
    if (m) {
      description = description ?? [m.name, m.spec].filter(Boolean).join(" ");
      unit = m.unit;
    }
  }
  if (!description) fail(back, "اختر المادة أو اكتب وصف البند.");
  const { data: inv } = await db.from("purchase_invoices").select("received_at").eq("id", invoiceId).single();
  if (inv?.received_at && material_id) fail(back, "المواد مستلمة. أضف مادة بفاتورة جديدة حتى يبقى المخزن صحيح.");
  const { count } = await db.from("purchase_lines").select("id", { count: "exact", head: true }).eq("invoice_id", invoiceId);
  const { error } = await db.from("purchase_lines").insert({
    invoice_id: invoiceId,
    position: (count ?? 0) + 1,
    material_id,
    description,
    qty: numOrNull(form, "qty") ?? 1,
    unit,
    unit_price: numOr0(form, "unit_price"),
  });
  if (error) fail(back, dbError(error));
  revalidatePath(back);
}

export async function deletePurchaseLine(form: FormData) {
  const db = await supabase();
  const invoiceId = str(form, "invoice_id")!;
  const back = `/purchases/invoices/${invoiceId}`;
  const { data: inv } = await db.from("purchase_invoices").select("received_at").eq("id", invoiceId).single();
  const { data: line } = await db.from("purchase_lines").select("material_id").eq("id", str(form, "id")!).single();
  if (inv?.received_at && line?.material_id) fail(back, "المواد مستلمة للمخزن، ما ينحذف بندها. احذف الفاتورة كلها إذا كانت غلط.");
  const { error } = await db.from("purchase_lines").delete().eq("id", str(form, "id")!);
  if (error) fail(back, dbError(error));
  revalidatePath(back);
}

export async function receivePurchase(form: FormData) {
  const db = await supabase();
  const id = str(form, "id")!;
  const back = `/purchases/invoices/${id}`;
  const { data, error } = await db.rpc("receive_purchase", { p_invoice: id });
  if (error) fail(back, error.message);
  revalidatePath("/stock");
  revalidatePath(back);
  redirect(back + "?ok=" + encodeURIComponent(`دخلت ${data} مادة للمخزن، والسعر اتحدّث.`));
}

export async function deletePurchase(form: FormData) {
  const db = await supabase();
  const id = str(form, "id")!;
  const back = `/purchases/invoices/${id}`;
  if (str(form, "confirm") !== "yes") fail(back, "أشّر على التأكيد قبل الحذف.");
  const { count } = await db.from("supplier_payments").select("id", { count: "exact", head: true }).eq("invoice_id", id);
  if (count) fail(back, "على الفاتورة تسديدات. احذفها أول.");
  // حذف الفاتورة يحذف حركات استلامها، فترجع كميات المخزن
  const { error } = await db.from("purchase_invoices").delete().eq("id", id);
  if (error) fail(back, dbError(error));
  revalidatePath("/purchases/invoices");
  revalidatePath("/stock");
  redirect("/purchases/invoices");
}

// ---------- تسديد الموردين ----------
export async function saveSupplierPayment(form: FormData) {
  await getMe();
  const db = await supabase();
  const back = str(form, "back") ?? "/purchases/payments";
  const supplier_id = str(form, "supplier_id");
  const amount = numOrNull(form, "amount");
  if (!supplier_id || !amount || amount <= 0) fail(back, "اختر المورد واكتب المبلغ.");
  const { error } = await db.from("supplier_payments").insert({
    supplier_id,
    invoice_id: str(form, "invoice_id"),
    day: str(form, "day") ?? undefined,
    amount,
    currency: str(form, "currency") ?? "IQD",
    method: str(form, "method") ?? "cash",
    note: str(form, "note"),
  });
  if (error) fail(back, dbError(error));
  revalidatePath(back);
  redirect(back + (back.includes("?") ? "&" : "?") + "ok=" + encodeURIComponent("انسجل التسديد."));
}

export async function deleteSupplierPayment(form: FormData) {
  const db = await supabase();
  const back = str(form, "back") ?? "/purchases/payments";
  const { error } = await db.from("supplier_payments").delete().eq("id", str(form, "id")!);
  if (error) fail(back, dbError(error));
  revalidatePath(back);
}
