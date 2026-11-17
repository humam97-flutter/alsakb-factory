"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { dbError, fail, list, numOr0, numOrNull, str } from "@/lib/form";
import { DEFAULT_MILESTONES, milestoneLines, retentionHeld } from "@/lib/projects";
import { supabase } from "@/lib/supabase/server";

const go = (path: string, ok?: string) => {
  revalidatePath(path.split("?")[0]);
  redirect(ok ? `${path}${path.includes("?") ? "&" : "?"}ok=${encodeURIComponent(ok)}` : path);
};

// ---------- المشروع ----------
export async function saveProject(form: FormData) {
  const db = await supabase();
  const id = str(form, "id");
  const back = id ? `/projects/${id}` : "/projects/new";
  const row = {
    name: str(form, "name") ?? "مشروع",
    customer_id: str(form, "customer_id"),
    contract_no: str(form, "contract_no"),
    contract_value: numOr0(form, "contract_value"),
    currency: str(form, "currency") ?? "IQD",
    start_date: str(form, "start_date"),
    end_date: str(form, "end_date"),
    status: str(form, "status") ?? "active",
    retention_pct: numOrNull(form, "retention_pct") ?? 5,
    advance_pct: numOrNull(form, "advance_pct") ?? 0,
    manager: str(form, "manager"),
    notes: str(form, "notes"),
  };
  const res = id ? await db.from("projects").update(row).eq("id", id).select("id").single() : await db.from("projects").insert(row).select("id").single();
  if (res.error) fail(back, dbError(res.error));
  const pid = res.data.id;
  if (!id) {
    // جدول دفعات افتراضي، والسلفة تنسترد بنفس نسبتها
    const adv = DEFAULT_MILESTONES.find((m) => m.kind === "advance")!.pct;
    if (str(form, "default_milestones") === "yes") {
      await db.from("project_milestones").insert(DEFAULT_MILESTONES.map((m, i) => ({ project_id: pid, position: i + 1, name: m.name, kind: m.kind, pct: m.pct, trigger_progress: m.trigger ?? null })));
      await db.from("projects").update({ advance_pct: adv }).eq("id", pid).eq("advance_pct", 0);
    }
    const orders = list(form, "order_ids");
    if (orders.length) await db.from("work_orders").update({ project_id: pid }).in("id", orders);
    const tender = str(form, "tender_id");
    if (tender) await db.from("tenders").update({ project_id: pid, status: "won" }).eq("id", tender);
  }
  revalidatePath("/projects");
  go(`/projects/${pid}`, "انحفظ المشروع");
}

export async function deleteProject(form: FormData) {
  const db = await supabase();
  const id = str(form, "id")!;
  if (str(form, "confirm") !== "yes") fail(`/projects/${id}`, "أشّر على التأكيد قبل الحذف.");
  const { error } = await db.from("projects").delete().eq("id", id);
  if (error) fail(`/projects/${id}`, dbError(error));
  revalidatePath("/projects");
  redirect("/projects");
}

export async function linkOrder(form: FormData) {
  const db = await supabase();
  const pid = str(form, "project_id")!;
  const oid = str(form, "order_id");
  if (!oid) fail(`/projects/${pid}`, "اختار الأمر.");
  const { error } = await db.from("work_orders").update({ project_id: str(form, "unlink") === "yes" ? null : pid }).eq("id", oid);
  if (error) fail(`/projects/${pid}`, dbError(error));
  go(`/projects/${pid}#orders`);
}

// ---------- الدفعات ----------
export async function saveMilestone(form: FormData) {
  const db = await supabase();
  const pid = str(form, "project_id")!;
  const id = str(form, "id");
  const row = {
    name: str(form, "name") ?? "دفعة",
    kind: str(form, "kind") ?? "progress",
    pct: numOr0(form, "pct"),
    order_id: str(form, "order_id"),
    trigger_progress: numOrNull(form, "trigger_progress"),
    due_date: str(form, "due_date"),
  };
  if (id) {
    const { error } = await db.from("project_milestones").update(row).eq("id", id);
    if (error) fail(`/projects/${pid}`, dbError(error));
  } else {
    const { data: last } = await db.from("project_milestones").select("position").eq("project_id", pid).order("position", { ascending: false }).limit(1).maybeSingle();
    const { error } = await db.from("project_milestones").insert({ ...row, project_id: pid, position: (last?.position ?? 0) + 1 });
    if (error) fail(`/projects/${pid}`, dbError(error));
  }
  go(`/projects/${pid}#milestones`);
}

export async function deleteMilestone(form: FormData) {
  const db = await supabase();
  const pid = str(form, "project_id")!;
  const { error } = await db.from("project_milestones").delete().eq("id", str(form, "id")!).eq("status", "pending");
  if (error) fail(`/projects/${pid}`, dbError(error));
  go(`/projects/${pid}#milestones`);
}

// فاتورة الدفعة: المبلغ، ناقص المحتجز واسترداد السلفة
export async function invoiceMilestone(form: FormData) {
  const db = await supabase();
  const pid = str(form, "project_id")!;
  const back = `/projects/${pid}`;
  const [{ data: p }, { data: ms }] = await Promise.all([
    db.from("projects").select("*").eq("id", pid).single(),
    db.from("project_milestones").select("*").eq("project_id", pid).order("position"),
  ]);
  const m = (ms ?? []).find((x) => x.id === str(form, "id"));
  if (!p || !m) fail(back, "الدفعة غير موجودة.");
  if (m.status !== "pending") fail(back, "الدفعة مفوترة من قبل.");
  if (!p.customer_id) fail(back, "حدد زبون المشروع أولاً.");
  const lines = milestoneLines(p, m, retentionHeld(p, ms ?? []), `${p.name}: ${m.name}`);
  if (lines.reduce((a, l) => a + l.amount, 0) <= 0) fail(back, "مبلغ الدفعة صفر. راجع النسبة أو قيمة العقد.");
  const { data: inv, error } = await db
    .from("invoices")
    .insert({ customer_id: p.customer_id, currency: p.currency, project_id: pid, order_id: m.order_id, notes: p.contract_no ? `عقد رقم ${p.contract_no}` : null })
    .select("id")
    .single();
  if (error) fail(back, dbError(error));
  const r2 = (n: number) => Math.round(n * 100) / 100;
  await db.from("invoice_lines").insert(lines.map((l, i) => ({ invoice_id: inv.id, position: i + 1, description: l.description, qty: 1, unit: null, unit_price: r2(l.amount) })));
  await db.from("project_milestones").update({ status: "invoiced", invoice_id: inv.id }).eq("id", m.id);
  revalidatePath(back);
  revalidatePath("/sales/invoices");
  redirect(`/sales/invoices/${inv.id}`);
}

// ---------- خطابات الضمان ----------
export async function saveGuarantee(form: FormData) {
  const db = await supabase();
  const back = str(form, "back") ?? "/projects/guarantees";
  const id = str(form, "id");
  const row = {
    project_id: str(form, "project_id"),
    tender_id: str(form, "tender_id"),
    customer_id: str(form, "customer_id"),
    kind: str(form, "kind") ?? "performance",
    bank: str(form, "bank"),
    ref_no: str(form, "ref_no"),
    amount: numOr0(form, "amount"),
    currency: str(form, "currency") ?? "IQD",
    issued_on: str(form, "issued_on"),
    expires_on: str(form, "expires_on"),
    fee: numOr0(form, "fee"),
    cash_margin: numOr0(form, "cash_margin"),
    notes: str(form, "notes"),
  };
  const { error } = id ? await db.from("guarantees").update(row).eq("id", id) : await db.from("guarantees").insert(row);
  if (error) fail(back, dbError(error));
  go(back, "انحفظ خطاب الضمان");
}

export async function setGuaranteeStatus(form: FormData) {
  const db = await supabase();
  const back = str(form, "back") ?? "/projects/guarantees";
  const { error } = await db.from("guarantees").update({ status: str(form, "status") }).eq("id", str(form, "id")!);
  if (error) fail(back, dbError(error));
  go(back);
}

export async function deleteGuarantee(form: FormData) {
  const db = await supabase();
  const back = str(form, "back") ?? "/projects/guarantees";
  const { error } = await db.from("guarantees").delete().eq("id", str(form, "id")!);
  if (error) fail(back, dbError(error));
  go(back);
}

// ---------- المناقصات ----------
export async function saveTender(form: FormData) {
  const db = await supabase();
  const id = str(form, "id");
  const row = {
    title: str(form, "title") ?? "مناقصة",
    customer_id: str(form, "customer_id"),
    issuer: str(form, "issuer"),
    ref_no: str(form, "ref_no"),
    published_on: str(form, "published_on"),
    submit_due: str(form, "submit_due"),
    bid_bond: numOr0(form, "bid_bond"),
    doc_fee: numOr0(form, "doc_fee"),
    estimate_id: str(form, "estimate_id"),
    our_price: numOrNull(form, "our_price"),
    currency: str(form, "currency") ?? "IQD",
    notes: str(form, "notes"),
  };
  const { error } = id ? await db.from("tenders").update(row).eq("id", id) : await db.from("tenders").insert(row);
  if (error) fail("/projects/tenders", dbError(error));
  go("/projects/tenders", "انحفظت المناقصة");
}

export async function setTenderResult(form: FormData) {
  const db = await supabase();
  const id = str(form, "id")!;
  const status = str(form, "status") ?? "submitted";
  const { error } = await db.from("tenders").update({ status, winner: str(form, "winner"), winner_price: numOrNull(form, "winner_price") }).eq("id", id);
  if (error) fail("/projects/tenders", dbError(error));
  // خطاب ضمان الدخول يرجع إذا خسرنا أو انلغت
  if (status === "lost" || status === "cancelled") await db.from("guarantees").update({ status: "released" }).eq("tender_id", id).eq("kind", "bid").eq("status", "active");
  go("/projects/tenders");
}

export async function deleteTender(form: FormData) {
  const db = await supabase();
  const { error } = await db.from("tenders").delete().eq("id", str(form, "id")!);
  if (error) fail("/projects/tenders", dbError(error));
  go("/projects/tenders");
}
