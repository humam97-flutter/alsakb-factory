import { Alert, type PageProps } from "@/components/ui";
import { supabase } from "@/lib/supabase/server";
import { saveProject } from "../actions";
import { ProjectFields } from "../form";

export default async function NewProjectPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const db = await supabase();
  const [{ data: customers }, { data: orders }, { data: tender }] = await Promise.all([
    db.from("customers").select("id, name").eq("active", true).order("name"),
    db.from("work_orders").select("id, no, product, client").is("project_id", null).in("status", ["new", "in_progress", "on_hold"]).order("no", { ascending: false }).limit(60),
    sp.tender ? db.from("tenders").select("id, title, customer_id, our_price, currency").eq("id", sp.tender).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  return (
    <>
      <Alert error={sp.error} />
      <div className="bar"><h2>مشروع جديد{tender ? ` من المناقصة: ${tender.title}` : ""}</h2></div>
      <form action={saveProject} className="panel">
        {tender && <input type="hidden" name="tender_id" value={tender.id} />}
        <ProjectFields p={{ name: tender?.title, customer_id: tender?.customer_id, contract_value: tender?.our_price ?? undefined, currency: tender?.currency }} customers={customers ?? []} />
        <div className="checks" style={{ marginTop: 12 }}>
          <label><input type="checkbox" name="default_milestones" value="yes" defaultChecked /> جدول دفعات افتراضي: سلفة 20% تنسترد من الدفعات، ثلاث دفعات إنجاز (25% و30% و25%)، تسليم 20%، وإطلاق المحتجز</label>
        </div>
        {orders?.length ? (
          <>
            <p className="meta" style={{ marginBottom: 4 }}>أوامر العمل اللي تنضم للمشروع:</p>
            <div className="checks">
              {orders.map((o) => <label key={o.id}><input type="checkbox" name="order_ids" value={o.id} /> <span className="num">#{o.no}</span> {o.product}</label>)}
            </div>
          </>
        ) : null}
        <div className="actions"><button className="btn" type="submit">حفظ المشروع</button></div>
      </form>
    </>
  );
}
