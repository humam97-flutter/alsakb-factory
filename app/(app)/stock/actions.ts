"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { dbError, fail, numOr0, numOrNull, str } from "@/lib/form";
import { supabase } from "@/lib/supabase/server";

export async function saveMaterial(form: FormData) {
  const db = await supabase();
  const id = str(form, "id");
  const back = id ? `/stock/${id}` : "/stock/new";
  const name = str(form, "name");
  if (!name) fail(back, "اكتب اسم المادة.");
  const row = {
    name,
    kind: str(form, "kind"),
    grade: str(form, "grade"),
    spec: str(form, "spec"),
    unit: str(form, "unit") ?? "قطعة",
    min_qty: numOrNull(form, "min_qty"),
    unit_price: numOr0(form, "unit_price"),
    currency: str(form, "currency") ?? "IQD",
    location: str(form, "location"),
    notes: str(form, "notes"),
  };
  if (id) {
    const { error } = await db.from("materials").update(row).eq("id", id);
    if (error) fail(back, dbError(error));
  } else {
    const { data, error } = await db.from("materials").insert(row).select("id").single();
    if (error) fail(back, dbError(error));
    // الرصيد الافتتاحي يُسجل كحركة استلام حتى يبقى تاريخ المخزن كاملاً
    const opening = numOr0(form, "opening_qty");
    if (opening > 0) {
      await db.from("stock_moves").insert({ material_id: data.id, kind: "receive", qty: opening, note: "رصيد افتتاحي" });
    }
  }
  revalidatePath("/stock");
  redirect("/stock");
}

export async function deleteMaterial(form: FormData) {
  const db = await supabase();
  const id = str(form, "id")!;
  if (form.get("confirm") !== "yes") fail(`/stock/${id}`, "علّم مربع التأكيد قبل الحذف.");
  const { error } = await db.from("materials").delete().eq("id", id);
  if (error) fail(`/stock/${id}`, error.code === "23503" ? "لا يمكن حذف مادة لها حركات مخزن." : dbError(error));
  revalidatePath("/stock");
  redirect("/stock");
}

export async function saveMove(form: FormData) {
  const db = await supabase();
  const kind = str(form, "kind") ?? "issue";
  const material_id = str(form, "material_id");
  let qty = numOrNull(form, "qty");
  const back = `/stock/move?kind=${kind}`;
  if (!material_id || !qty) fail(back, "اختر المادة واكتب الكمية.");
  // التسوية: الكمية المكتوبة هي الرصيد الفعلي بعد الجرد
  if (kind === "adjust") {
    const { data: m } = await db.from("materials").select("qty").eq("id", material_id).single();
    qty = qty - Number(m?.qty ?? 0);
    if (qty === 0) fail(back, "الرصيد مطابق، لا حاجة لتسوية.");
  } else if (qty <= 0) fail(back, "الكمية لازم تكون أكبر من صفر.");
  const order_id = kind === "issue" ? str(form, "order_id") : null;
  const { error } = await db.from("stock_moves").insert({
    material_id,
    kind,
    qty,
    order_id,
    unit_price: numOr0(form, "unit_price"),
    day: str(form, "day") ?? undefined,
    note: str(form, "note"),
  });
  if (error) fail(back, dbError(error));
  revalidatePath("/stock");
  if (order_id) redirect(`/orders/${order_id}`);
  redirect("/stock?ok=" + encodeURIComponent("تم تسجيل الحركة."));
}

export async function deleteMove(form: FormData) {
  const db = await supabase();
  const { error } = await db.from("stock_moves").delete().eq("id", str(form, "id")!);
  if (error) fail("/stock", dbError(error));
  revalidatePath("/stock");
  redirect("/stock?ok=" + encodeURIComponent("حُذفت الحركة وأُعيدت الكمية."));
}
