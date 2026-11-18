"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { dbError, fail, str } from "@/lib/form";
import type { ScanResult } from "@/lib/scan";
import { supabase } from "@/lib/supabase/server";

const back = "/assistant/scan";
const ok = (path: string, msg: string) => redirect(`${path}${path.includes("?") ? "&" : "?"}ok=${encodeURIComponent(msg)}`);

async function supplierId(db: Awaited<ReturnType<typeof supabase>>, name: string | null, create: boolean) {
  if (!name) return null;
  const { data } = await db.from("suppliers").select("id").ilike("name", name.trim()).maybeSingle();
  if (data || !create) return data?.id ?? null;
  const { data: n } = await db.from("suppliers").insert({ name: name.trim(), notes: "انضاف تلقائياً من قراءة فاتورة" }).select("id").single();
  return n?.id ?? null;
}

// حفظ نتيجة القراءة بعد ما المستخدم يراجعها: ألواح للمخزن، شهادات لأمر عمل، أو فاتورة مشتريات مسودة
export async function saveScan(form: FormData) {
  const db = await supabase();
  let r: ScanResult;
  try {
    r = JSON.parse(str(form, "data") ?? "");
  } catch {
    fail(back, "البيانات ناقصة. اقرأ المستند مرة ثانية.");
  }
  const items = (r.items ?? []).filter((x) => x.description || x.grade);
  if (!items.length) fail(back, "ماكو أسطر للحفظ.");
  const to = str(form, "to");

  if (to === "plates") {
    const ok_ = items.filter((x) => Number(x.thickness_mm) > 0 && Number(x.length_mm) > 0 && Number(x.width_mm) > 0);
    if (!ok_.length) fail(back, "ولا سطر بيه سمك وطول وعرض. كمّل القياسات أولاً.");
    const sup = await supplierId(db, r.supplier, false);
    const rows = ok_.flatMap((x) =>
      Array.from({ length: Math.max(1, Math.min(200, Math.round(Number(x.qty) || 1))) }, () => ({
        grade: x.grade || "A36",
        thickness: Number(x.thickness_mm),
        length_mm: Number(x.length_mm),
        width_mm: Number(x.width_mm),
        heat_no: x.heat_no,
        cert_no: r.doc_no,
        supplier_id: sup,
        received_on: r.date ?? undefined,
        notes: r.standard ? `المواصفة: ${r.standard}` : null,
      })),
    );
    const { error } = await db.from("plates").insert(rows);
    if (error) fail(back, dbError(error));
    revalidatePath("/cutting");
    ok("/cutting", `انضاف ${rows.length} لوح للمخزن مع رقم الصبة والشهادة`);
  }

  if (to === "cert") {
    const orderId = str(form, "order_id");
    if (!orderId) fail(back, "اختار أمر العمل.");
    const { error } = await db.from("material_certs").insert(
      items.map((x) => ({
        order_id: orderId,
        item: x.description || "مادة",
        grade: x.grade,
        size: [x.thickness_mm && `${x.thickness_mm}`, x.length_mm && `${x.length_mm}`, x.width_mm && `${x.width_mm}`].filter(Boolean).join("×") || null,
        qty: x.qty,
        heat_no: x.heat_no,
        cert_no: r.doc_no,
        supplier: r.supplier,
      })),
    );
    if (error) fail(back, dbError(error));
    revalidatePath(`/orders/${orderId}/qa`);
    ok(`/orders/${orderId}/qa`, "انحفظت الشهادة بملف الجودة");
  }

  if (to === "invoice") {
    const sup = await supplierId(db, r.supplier, true);
    if (!sup) fail(back, "اكتب اسم المورد.");
    const { data: inv, error } = await db
      .from("purchase_invoices")
      .insert({ supplier_id: sup, supplier_ref: r.doc_no, day: r.date ?? undefined, currency: r.currency === "USD" ? "USD" : "IQD", notes: "مسودة من قراءة الفاتورة بالذكاء الاصطناعي. راجع الأسطر واربطها بالمواد قبل الاستلام." })
      .select("id")
      .single();
    if (error) fail(back, dbError(error));
    await db.from("purchase_lines").insert(
      items.map((x, i) => ({
        invoice_id: inv.id,
        position: i + 1,
        description: [x.description, x.grade, x.thickness_mm && `سمك ${x.thickness_mm}`, x.heat_no && `Heat ${x.heat_no}`].filter(Boolean).join(" · "),
        qty: Number(x.qty) || 1,
        unit: x.unit,
        unit_price: Number(x.unit_price) || 0,
      })),
    );
    revalidatePath("/purchases/invoices");
    redirect(`/purchases/invoices/${inv.id}?ok=${encodeURIComponent("انعملت الفاتورة مسودة. راجعها واربط الأسطر بالمواد")}`);
  }
  fail(back, "اختار وين تنحفظ.");
}

// ---------- إعدادات الذكاء الاصطناعي والتقرير اليومي ----------
export async function saveAiSettings(form: FormData) {
  const db = await supabase();
  const { error } = await db
    .from("settings")
    .update({
      telegram_chat_id: str(form, "telegram_chat_id"),
      report_enabled: str(form, "report_enabled") === "on",
      ai_enabled: str(form, "ai_enabled") === "on",
      ai_monthly_limit: Math.max(0, Math.round(Number(str(form, "ai_monthly_limit") ?? 2000)) || 0),
    })
    .eq("id", 1);
  if (error) fail("/settings#ai", dbError(error));
  revalidatePath("/settings");
  ok("/settings", "انحفظت إعدادات الذكاء الاصطناعي والتقرير");
}

export async function sendTestReport() {
  const db = await supabase();
  const { data: st } = await db.from("settings").select("telegram_chat_id").eq("id", 1).maybeSingle();
  if (!st?.telegram_chat_id) fail("/settings", "اكتب رقم محادثة تيليكرام واحفظ أولاً.");
  const { dailyReport } = await import("@/lib/daily-report");
  const { sendTelegram } = await import("@/lib/telegram");
  const { siteUrl } = await import("@/lib/site");
  const err = await sendTelegram(st.telegram_chat_id, await dailyReport(db, siteUrl()));
  if (err) fail("/settings", err);
  ok("/settings", "انرسل التقرير لتيليكرام");
}
