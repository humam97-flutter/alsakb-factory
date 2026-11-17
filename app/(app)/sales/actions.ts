"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { dbError, fail, numOr0, numOrNull, str } from "@/lib/form";
import { ensureCustomer } from "@/lib/customers";
import { supabase } from "@/lib/supabase/server";

// ---------- الزبائن ----------
export async function saveCustomer(form: FormData) {
  const db = await supabase();
  const id = str(form, "id");
  const back = id ? `/sales/customers/${id}` : "/sales/customers/new";
  const name = str(form, "name");
  if (!name) fail(back, "اكتب اسم الزبون.");
  const row = { name, phone: str(form, "phone"), address: str(form, "address"), notes: str(form, "notes"), active: str(form, "active") !== "no" };
  const res = id
    ? await db.from("customers").update(row).eq("id", id).select("id").single()
    : await db.from("customers").insert(row).select("id").single();
  if (res.error) fail(back, dbError(res.error));
  revalidatePath("/sales/customers");
  redirect(`/sales/customers/${res.data.id}`);
}

// ---------- عروض الأسعار ----------
export async function saveQuote(form: FormData) {
  const db = await supabase();
  const id = str(form, "id");
  const back = id ? `/sales/quotes/${id}` : "/sales/quotes/new";
  const customer_id = str(form, "customer_id") ?? (await ensureCustomer(db, str(form, "new_customer"), str(form, "new_phone")));
  const row = {
    customer_id,
    day: str(form, "day") ?? undefined,
    valid_until: str(form, "valid_until"),
    currency: str(form, "currency") ?? "IQD",
    discount: numOr0(form, "discount"),
    notes: str(form, "notes"),
    ...(str(form, "status") ? { status: str(form, "status") } : {}),
  };
  const res = id
    ? await db.from("quotes").update(row).eq("id", id).select("id").single()
    : await db.from("quotes").insert(row).select("id").single();
  if (res.error) fail(back, dbError(res.error));
  revalidatePath("/sales/quotes");
  redirect(`/sales/quotes/${res.data.id}`);
}

export async function setQuoteStatus(form: FormData) {
  const db = await supabase();
  const id = str(form, "id")!;
  const { error } = await db.from("quotes").update({ status: str(form, "status") }).eq("id", id);
  if (error) fail(`/sales/quotes/${id}`, dbError(error));
  revalidatePath(`/sales/quotes/${id}`);
}

export async function deleteQuote(form: FormData) {
  const db = await supabase();
  const id = str(form, "id")!;
  if (str(form, "confirm") !== "yes") fail(`/sales/quotes/${id}`, "أشّر على التأكيد قبل الحذف.");
  const { error } = await db.from("quotes").delete().eq("id", id);
  if (error) fail(`/sales/quotes/${id}`, dbError(error));
  revalidatePath("/sales/quotes");
  redirect("/sales/quotes");
}

// العرض المقبول يصير أمر عمل، بسعره
export async function quoteToOrder(form: FormData) {
  const db = await supabase();
  const id = str(form, "id")!;
  const back = `/sales/quotes/${id}`;
  const [{ data: q }, { data: lines }, { data: tot }] = await Promise.all([
    db.from("quotes").select("*, customer:customers(name, phone)").eq("id", id).single(),
    db.from("quote_lines").select("description, qty, unit").eq("quote_id", id).order("position"),
    db.from("quote_totals").select("total").eq("quote_id", id).single(),
  ]);
  if (!q) fail(back, "العرض غير موجود.");
  if (q.order_id) redirect(`/orders/${q.order_id}`);
  const c = q.customer as { name: string; phone: string | null } | null;
  const first = lines?.[0];
  const { data: o, error } = await db
    .from("work_orders")
    .insert({
      product: first?.description ?? `عرض سعر #${q.no}`,
      qty: lines?.length === 1 ? first?.qty : null,
      unit: lines?.length === 1 ? first?.unit : null,
      client: c?.name ?? null,
      client_phone: c?.phone ?? null,
      customer_id: q.customer_id,
      notes: [`من عرض السعر #${q.no}`, ...(lines ?? []).map((l) => `- ${l.description}: ${l.qty} ${l.unit ?? ""}`)].join("\n"),
    })
    .select("id")
    .single();
  if (error) fail(back, dbError(error));
  await db.from("work_order_finance").upsert({ order_id: o.id, price: tot?.total ?? null, currency: q.currency });
  await db.from("quotes").update({ order_id: o.id, status: "accepted" }).eq("id", id);
  revalidatePath("/orders");
  redirect(`/orders/${o.id}`);
}

// ---------- الفواتير ----------
export async function saveInvoice(form: FormData) {
  const db = await supabase();
  const id = str(form, "id");
  const back = id ? `/sales/invoices/${id}` : "/sales/invoices/new";
  const customer_id = str(form, "customer_id") ?? (await ensureCustomer(db, str(form, "new_customer"), str(form, "new_phone")));
  if (!customer_id) fail(back, "اختر الزبون أو اكتب اسم زبون جديد.");
  const row = {
    customer_id,
    order_id: str(form, "order_id"),
    day: str(form, "day") ?? undefined,
    due_date: str(form, "due_date"),
    currency: str(form, "currency") ?? "IQD",
    discount: numOr0(form, "discount"),
    notes: str(form, "notes"),
    cancelled: str(form, "cancelled") === "yes",
  };
  const res = id
    ? await db.from("invoices").update(row).eq("id", id).select("id").single()
    : await db.from("invoices").insert(row).select("id").single();
  if (res.error) fail(back, dbError(res.error));
  revalidatePath("/sales/invoices");
  redirect(`/sales/invoices/${res.data.id}`);
}

// فاتورة من عرض سعر أو من أمر عمل، مع بنودها
export async function invoiceFrom(form: FormData) {
  const db = await supabase();
  const quoteId = str(form, "quote_id");
  const orderId = str(form, "order_id");
  const back = quoteId ? `/sales/quotes/${quoteId}` : `/orders/${orderId}`;
  let customer_id: string | null = null;
  let currency = "IQD";
  let discount = 0;
  let lines: { description: string; qty: number; unit: string | null; unit_price: number }[] = [];
  let linkedOrder = orderId;
  if (quoteId) {
    const { data: q } = await db.from("quotes").select("*").eq("id", quoteId).single();
    if (!q) fail(back, "العرض غير موجود.");
    customer_id = q.customer_id;
    currency = q.currency;
    discount = Number(q.discount);
    linkedOrder = q.order_id;
    const { data: ql } = await db.from("quote_lines").select("description, qty, unit, unit_price").eq("quote_id", quoteId).order("position");
    lines = ql ?? [];
  } else if (orderId) {
    const [{ data: o }, { data: f }] = await Promise.all([
      db.from("work_orders").select("*").eq("id", orderId).single(),
      db.from("work_order_finance").select("price, currency").eq("order_id", orderId).maybeSingle(),
    ]);
    if (!o) fail(back, "الأمر غير موجود.");
    customer_id = o.customer_id ?? (await ensureCustomer(db, o.client, o.client_phone));
    if (customer_id && !o.customer_id) await db.from("work_orders").update({ customer_id }).eq("id", orderId);
    currency = f?.currency ?? "IQD";
    const qty = Number(o.qty) || 1;
    lines = [{ description: o.product, qty, unit: o.unit, unit_price: f?.price != null ? Number(f.price) / qty : 0 }];
  }
  if (!customer_id) fail(back, "حدد الزبون أولاً.");
  const { data: inv, error } = await db
    .from("invoices")
    .insert({ customer_id, currency, discount, order_id: linkedOrder, quote_id: quoteId })
    .select("id")
    .single();
  if (error) fail(back, dbError(error));
  if (lines.length) {
    await db.from("invoice_lines").insert(lines.map((l, i) => ({ ...l, invoice_id: inv.id, position: i + 1 })));
  }
  revalidatePath("/sales/invoices");
  redirect(`/sales/invoices/${inv.id}`);
}

export async function deleteInvoice(form: FormData) {
  const db = await supabase();
  const id = str(form, "id")!;
  if (str(form, "confirm") !== "yes") fail(`/sales/invoices/${id}`, "أشّر على التأكيد قبل الحذف.");
  const { count } = await db.from("customer_payments").select("id", { count: "exact", head: true }).eq("invoice_id", id);
  if (count) fail(`/sales/invoices/${id}`, "على الفاتورة مقبوضات. احذفها أول، أو ألغِ الفاتورة بدل حذفها.");
  const { error } = await db.from("invoices").delete().eq("id", id);
  if (error) fail(`/sales/invoices/${id}`, dbError(error));
  revalidatePath("/sales/invoices");
  redirect("/sales/invoices");
}

// ---------- البنود (للعرض والفاتورة) ----------
const LINES = { quote: ["quote_lines", "quote_id", "/sales/quotes/"], invoice: ["invoice_lines", "invoice_id", "/sales/invoices/"] } as const;

export async function addLine(form: FormData) {
  const db = await supabase();
  const kind = str(form, "kind") as keyof typeof LINES;
  const [table, key, path] = LINES[kind];
  const parent = str(form, "parent_id")!;
  const description = str(form, "description");
  if (!description) fail(path + parent, "اكتب وصف البند.");
  const { count } = await db.from(table).select("id", { count: "exact", head: true }).eq(key, parent);
  const { error } = await db.from(table).insert({
    [key]: parent,
    position: (count ?? 0) + 1,
    description,
    qty: numOrNull(form, "qty") ?? 1,
    unit: str(form, "unit"),
    unit_price: numOr0(form, "unit_price"),
  });
  if (error) fail(path + parent, dbError(error));
  revalidatePath(path + parent);
}

export async function deleteLine(form: FormData) {
  const db = await supabase();
  const kind = str(form, "kind") as keyof typeof LINES;
  const [table, , path] = LINES[kind];
  const parent = str(form, "parent_id")!;
  const { error } = await db.from(table).delete().eq("id", str(form, "id")!);
  if (error) fail(path + parent, dbError(error));
  revalidatePath(path + parent);
}

// ---------- المقبوضات ----------
export async function savePayment(form: FormData) {
  const db = await supabase();
  const back = str(form, "back") ?? "/sales/payments";
  const customer_id = str(form, "customer_id");
  const amount = numOrNull(form, "amount");
  if (!customer_id || !amount || amount <= 0) fail(back, "اختر الزبون واكتب المبلغ.");
  const { error } = await db.from("customer_payments").insert({
    customer_id,
    invoice_id: str(form, "invoice_id"),
    day: str(form, "day") ?? undefined,
    amount,
    currency: str(form, "currency") ?? "IQD",
    method: str(form, "method") ?? "cash",
    note: str(form, "note"),
  });
  if (error) fail(back, dbError(error));
  revalidatePath(back);
  revalidatePath("/sales/payments");
  redirect(back + (back.includes("?") ? "&" : "?") + "ok=" + encodeURIComponent("انسجل القبض."));
}

export async function deletePayment(form: FormData) {
  const db = await supabase();
  const back = str(form, "back") ?? "/sales/payments";
  const { error } = await db.from("customer_payments").delete().eq("id", str(form, "id")!);
  if (error) fail(back, dbError(error));
  revalidatePath(back);
}

// ---------- الإعدادات ----------
export async function saveSettings(form: FormData) {
  const db = await supabase();
  const { error } = await db
    .from("settings")
    .update({
      factory_name: str(form, "factory_name") ?? "معمل السكب الحديدي",
      address: str(form, "address"),
      phone: str(form, "phone"),
      invoice_footer: str(form, "invoice_footer"),
      usd_rate: numOrNull(form, "usd_rate") ?? 1500,
      ...(form.has("shift_hours") ? { shift_hours: numOrNull(form, "shift_hours") ?? 8 } : {}),
      ...(form.has("manager_name") ? { email: str(form, "email"), reg_no: str(form, "reg_no"), manager_name: str(form, "manager_name") } : {}),
    })
    .eq("id", 1);
  if (error) fail("/settings", dbError(error));
  revalidatePath("/", "layout");
  redirect("/settings?ok=" + encodeURIComponent("انحفظت الإعدادات."));
}

// شعار المعمل: ملف واحد بحاوية branding، ونحذف القديم
export async function saveLogo(files: { path: string }[]): Promise<{ error: string | null }> {
  const db = await supabase();
  const { data: old } = await db.from("settings").select("logo_path").eq("id", 1).maybeSingle();
  const { error } = await db.from("settings").update({ logo_path: files[0]?.path ?? null }).eq("id", 1);
  if (error) return { error: dbError(error) };
  if (old?.logo_path && old.logo_path !== files[0]?.path) await db.storage.from("branding").remove([old.logo_path]);
  revalidatePath("/", "layout");
  return { error: null };
}

export async function removeLogo() {
  const db = await supabase();
  const { data: old } = await db.from("settings").select("logo_path").eq("id", 1).maybeSingle();
  await db.from("settings").update({ logo_path: null }).eq("id", 1);
  if (old?.logo_path) await db.storage.from("branding").remove([old.logo_path]);
  revalidatePath("/", "layout");
  redirect("/settings?ok=" + encodeURIComponent("انشال الشعار."));
}
