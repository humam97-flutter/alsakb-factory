import { notFound } from "next/navigation";
import type { IdPageProps } from "@/components/ui";
import { supabase } from "@/lib/supabase/server";
import { PrintDoc } from "../../../print-doc";

export default async function PrintInvoicePage({ params }: IdPageProps) {
  const { id } = await params;
  const db = await supabase();
  const [{ data: inv }, { data: lines }, { data: tot }, { data: settings }] = await Promise.all([
    db.from("invoices").select("*, customer:customers(name, phone, address), order:work_orders(no)").eq("id", id).maybeSingle(),
    db.from("invoice_lines").select("*").eq("invoice_id", id).order("position"),
    db.from("invoice_totals").select("*").eq("invoice_id", id).maybeSingle(),
    db.from("settings").select("*").eq("id", 1).maybeSingle(),
  ]);
  if (!inv) notFound();
  const order = inv.order as { no: number } | null;
  return (
    <PrintDoc
      title={inv.cancelled ? "فاتورة (ملغاة)" : "فاتورة"}
      no={inv.no}
      day={inv.day}
      extra={[["موعد الدفع", inv.due_date], ["أمر العمل", order ? String(order.no) : null]]}
      customer={inv.customer as { name: string; phone: string | null; address: string | null }}
      lines={lines ?? []}
      currency={inv.currency}
      subtotal={Number(tot?.subtotal ?? 0)}
      discount={Number(inv.discount)}
      total={Number(tot?.total ?? 0)}
      paid={Number(tot?.paid ?? 0)}
      notes={inv.notes}
      settings={settings}
    />
  );
}
