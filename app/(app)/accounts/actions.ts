"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { dbError, fail, numOrNull, str } from "@/lib/form";
import { supabase } from "@/lib/supabase/server";

export async function saveExpense(form: FormData) {
  const db = await supabase();
  const back = str(form, "back") ?? "/accounts/expenses";
  const amount = numOrNull(form, "amount");
  const category = str(form, "category");
  if (!amount || amount <= 0 || !category) fail(back, "اختر النوع واكتب المبلغ.");
  const { error } = await db.from("expenses").insert({
    day: str(form, "day") ?? undefined,
    category,
    amount,
    currency: str(form, "currency") ?? "IQD",
    method: str(form, "method") ?? "cash",
    note: str(form, "note"),
  });
  if (error) fail(back, dbError(error));
  revalidatePath(back);
  redirect(back + (back.includes("?") ? "&" : "?") + "ok=" + encodeURIComponent("انسجل المصروف."));
}

export async function deleteExpense(form: FormData) {
  const db = await supabase();
  const back = str(form, "back") ?? "/accounts/expenses";
  const { error } = await db.from("expenses").delete().eq("id", str(form, "id")!);
  if (error) fail(back, dbError(error));
  revalidatePath(back);
}

export async function saveCashEntry(form: FormData) {
  const db = await supabase();
  const back = "/accounts/cash";
  const kind = str(form, "kind") ?? "deposit";
  const amount = numOrNull(form, "amount");
  const currency = str(form, "currency") ?? "IQD";
  const day = str(form, "day") ?? undefined;
  const note = str(form, "note");
  if (!amount || amount <= 0) fail(back, "اكتب المبلغ.");
  if (kind === "exchange") {
    // تصريف: يطلع مبلغ من عملة ويدخل مقابله بالعملة الثانية
    const got = numOrNull(form, "got");
    if (!got || got <= 0) fail(back, "اكتب المبلغ اللي استلمته بالعملة الثانية.");
    const other = currency === "USD" ? "IQD" : "USD";
    const pair = crypto.randomUUID();
    const { error } = await db.from("cash_entries").insert([
      { kind, amount: -amount, currency, pair_id: pair, day, note },
      { kind, amount: got, currency: other, pair_id: pair, day, note },
    ]);
    if (error) fail(back, dbError(error));
  } else {
    const { error } = await db.from("cash_entries").insert({ kind, amount: kind === "withdraw" ? -amount : amount, currency, day, note });
    if (error) fail(back, dbError(error));
  }
  revalidatePath(back);
  redirect(back + "?ok=" + encodeURIComponent("انسجلت الحركة."));
}

export async function deleteCashEntry(form: FormData) {
  const db = await supabase();
  const id = str(form, "id")!;
  const { data: e } = await db.from("cash_entries").select("pair_id").eq("id", id).maybeSingle();
  const { error } = e?.pair_id
    ? await db.from("cash_entries").delete().eq("pair_id", e.pair_id)
    : await db.from("cash_entries").delete().eq("id", id);
  if (error) fail("/accounts/cash", dbError(error));
  revalidatePath("/accounts/cash");
}
