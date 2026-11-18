import { Alert, type IdPageProps } from "@/components/ui";
import { aiReady } from "@/lib/ai";
import { can, requireRole } from "@/lib/auth";
import { supabase } from "@/lib/supabase/server";
import { Scanner } from "./scanner";

export default async function ScanPage({ searchParams }: Pick<IdPageProps, "searchParams">) {
  const sp = await searchParams;
  const me = await requireRole((r) => r !== "operator");
  const db = await supabase();
  const { data: orders } = await db.from("work_orders").select("id, no, product").in("status", ["new", "in_progress", "on_hold", "done"]).order("no", { ascending: false }).limit(200);
  return (
    <>
      <Alert error={sp.error} ok={sp.ok} />
      <div className="bar"><h2>قراءة الشهادات والفواتير</h2></div>
      <p className="meta" style={{ marginTop: -6 }}>صوّر شهادة المواد (MTC) أو فاتورة المورد، والنظام يطلّع رقم الصبة والنوع والقياسات والأسعار. راجعها وصحّح أي شي، وبعدين احفظها بالمكان المناسب.</p>
      {!aiReady() && <div className="alert">تحتاج مفتاح الذكاء الاصطناعي. المدير يضيف <bdi className="ltr">ANTHROPIC_API_KEY</bdi> بإعدادات Vercel.</div>}
      <Scanner
        orders={(orders ?? []).map((o) => ({ id: o.id, label: `#${o.no} ${o.product}` }))}
        canPlates={can.production(me.role) || can.stock(me.role)}
        canInvoice={can.finance(me.role)}
        disabled={!aiReady()}
      />
    </>
  );
}
