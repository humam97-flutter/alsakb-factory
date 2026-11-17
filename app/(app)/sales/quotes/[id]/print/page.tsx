import { notFound } from "next/navigation";
import type { IdPageProps } from "@/components/ui";
import { supabase } from "@/lib/supabase/server";
import { PrintDoc } from "../../../print-doc";

export default async function PrintQuotePage({ params }: IdPageProps) {
  const { id } = await params;
  const db = await supabase();
  const [{ data: q }, { data: lines }, { data: tot }, { data: settings }] = await Promise.all([
    db.from("quotes").select("*, customer:customers(name, phone, address)").eq("id", id).maybeSingle(),
    db.from("quote_lines").select("*").eq("quote_id", id).order("position"),
    db.from("quote_totals").select("*").eq("quote_id", id).maybeSingle(),
    db.from("settings").select("*").eq("id", 1).maybeSingle(),
  ]);
  if (!q) notFound();
  return (
    <PrintDoc
      title="عرض سعر"
      no={q.no}
      day={q.day}
      extra={[["صالح لغاية", q.valid_until]]}
      customer={q.customer as { name: string; phone: string | null; address: string | null } | null}
      lines={lines ?? []}
      currency={q.currency}
      subtotal={Number(tot?.subtotal ?? 0)}
      discount={Number(q.discount)}
      total={Number(tot?.total ?? 0)}
      notes={q.notes}
      settings={settings}
    />
  );
}
