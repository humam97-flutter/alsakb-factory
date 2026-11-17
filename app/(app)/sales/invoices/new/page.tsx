import { Alert, type PageProps } from "@/components/ui";
import { supabase } from "@/lib/supabase/server";
import { HeadForm } from "../../head-form";

export default async function NewInvoicePage({ searchParams }: PageProps) {
  const { error, customer } = await searchParams;
  const db = await supabase();
  const [{ data: customers }, { data: orders }] = await Promise.all([
    db.from("customers").select("id, name").eq("active", true).order("name"),
    db.from("work_orders").select("id, no, product, client").order("no", { ascending: false }).limit(300),
  ]);
  return (
    <>
      <div className="bar"><h2>فاتورة جديدة</h2></div>
      <p className="meta">تقدر تسوي الفاتورة مباشرة من صفحة أمر العمل أو عرض السعر، وتنزل بنودها وحدها.</p>
      <Alert error={error} />
      <HeadForm
        kind="invoice"
        r={null}
        customers={customers ?? []}
        customerId={customer}
        orders={(orders ?? []).map((o) => ({ id: o.id, label: `#${o.no} · ${o.product}${o.client ? " · " + o.client : ""}` }))}
      />
    </>
  );
}
