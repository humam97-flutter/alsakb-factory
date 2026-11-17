import Link from "next/link";
import { Alert, type PageProps } from "@/components/ui";
import { money, PAY_METHOD, today } from "@/lib/labels";
import { supabase } from "@/lib/supabase/server";
import { deletePayment } from "../actions";
import { PaymentForm } from "../payment-form";

export default async function PaymentsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const month = sp.month ?? today().slice(0, 7);
  const first = `${month}-01`;
  const next = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 1)).toISOString().slice(0, 10);
  const db = await supabase();
  const [{ data: payments }, { data: customers }] = await Promise.all([
    db.from("customer_payments").select("*, customer:customers(id, name), invoice:invoices(id, no)").gte("day", first).lt("day", next).order("day", { ascending: false }),
    db.from("customers").select("id, name").eq("active", true).order("name"),
  ]);
  const sum = (cur: string) => (payments ?? []).filter((p) => p.currency === cur).reduce((a, p) => a + Number(p.amount), 0);
  const back = `/sales/payments?month=${month}`;
  return (
    <>
      <Alert error={sp.error} ok={sp.ok} />
      <form className="bar" method="get">
        <h2>المقبوضات</h2>
        <input type="month" name="month" defaultValue={month} aria-label="الشهر" style={{ maxWidth: 180 }} />
        <button className="btn ghost sm" type="submit">عرض</button>
      </form>
      <div className="kpis">
        <div className="kpi"><b className="tone-ok">{money(sum("IQD"))}</b><span>مقبوض هذا الشهر بالدينار</span></div>
        {sum("USD") > 0 && <div className="kpi"><b className="tone-ok">{money(sum("USD"), "USD")}</b><span>بالدولار</span></div>}
      </div>
      <h3 className="sec">تسجيل قبض</h3>
      <PaymentForm back={back} customers={customers ?? []} />
      <h3 className="sec">قبوضات الشهر</h3>
      {!payments?.length ? (
        <div className="empty">ما بيه مقبوضات بهذا الشهر.</div>
      ) : (
        <div className="tbl">
          <table>
            <thead><tr><th>التاريخ</th><th>الزبون</th><th>الفاتورة</th><th>الطريقة</th><th>ملاحظة</th><th className="n">المبلغ</th><th></th></tr></thead>
            <tbody>
              {payments.map((p) => {
                const c = p.customer as { id: string; name: string };
                const i = p.invoice as { id: string; no: number } | null;
                return (
                  <tr key={p.id}>
                    <td className="num">{p.day}</td>
                    <td><Link href={`/sales/customers/${c.id}`}>{c.name}</Link></td>
                    <td>{i ? <Link href={`/sales/invoices/${i.id}`}>#{i.no}</Link> : "—"}</td>
                    <td>{PAY_METHOD[p.method]}</td>
                    <td>{p.note}</td>
                    <td className="n num pos">{money(p.amount, p.currency)}</td>
                    <td>
                      <form action={deletePayment}>
                        <input type="hidden" name="id" value={p.id} />
                        <input type="hidden" name="back" value={back} />
                        <button className="btn ghost sm" type="submit" aria-label="حذف">×</button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
