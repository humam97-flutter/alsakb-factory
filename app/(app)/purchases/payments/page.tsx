import Link from "next/link";
import { Alert, type PageProps } from "@/components/ui";
import { can, requireRole } from "@/lib/auth";
import { money, PAY_METHOD, today } from "@/lib/labels";
import { supabase } from "@/lib/supabase/server";
import { deleteSupplierPayment } from "../actions";
import { SupplierPayForm } from "../supplier-pay-form";

export default async function SupplierPaymentsPage({ searchParams }: PageProps) {
  await requireRole(can.finance);
  const sp = await searchParams;
  const month = sp.month ?? today().slice(0, 7);
  const first = `${month}-01`;
  const next = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 1)).toISOString().slice(0, 10);
  const db = await supabase();
  const [{ data: payments }, { data: suppliers }] = await Promise.all([
    db.from("supplier_payments").select("*, supplier:suppliers(id, name), invoice:purchase_invoices(id, no)").gte("day", first).lt("day", next).order("day", { ascending: false }),
    db.from("suppliers").select("id, name").eq("active", true).order("name"),
  ]);
  const sum = (cur: string) => (payments ?? []).filter((p) => p.currency === cur).reduce((a, p) => a + Number(p.amount), 0);
  const back = `/purchases/payments?month=${month}`;
  return (
    <>
      <Alert error={sp.error} ok={sp.ok} />
      <form className="bar" method="get">
        <h2>تسديد الموردين</h2>
        <input type="month" name="month" defaultValue={month} aria-label="الشهر" style={{ maxWidth: 180 }} />
        <button className="btn ghost sm" type="submit">عرض</button>
      </form>
      <div className="kpis">
        <div className="kpi"><b>{money(sum("IQD"))}</b><span>مسدد هذا الشهر بالدينار</span></div>
        {sum("USD") > 0 && <div className="kpi"><b>{money(sum("USD"), "USD")}</b><span>بالدولار</span></div>}
      </div>
      <h3 className="sec">تسجيل تسديد</h3>
      <SupplierPayForm back={back} suppliers={suppliers ?? []} />
      <h3 className="sec">تسديدات الشهر</h3>
      {!payments?.length ? (
        <div className="empty">ما بيه تسديدات بهذا الشهر.</div>
      ) : (
        <div className="tbl">
          <table>
            <thead><tr><th>التاريخ</th><th>المورد</th><th>الفاتورة</th><th>الطريقة</th><th>ملاحظة</th><th className="n">المبلغ</th><th></th></tr></thead>
            <tbody>
              {payments.map((p) => {
                const s = p.supplier as { id: string; name: string };
                const i = p.invoice as { id: string; no: number } | null;
                return (
                  <tr key={p.id}>
                    <td className="num">{p.day}</td>
                    <td><Link href={`/purchases/suppliers/${s.id}`}>{s.name}</Link></td>
                    <td>{i ? <Link href={`/purchases/invoices/${i.id}`}>#{i.no}</Link> : "—"}</td>
                    <td>{PAY_METHOD[p.method]}</td>
                    <td>{p.note}</td>
                    <td className="n num">{money(p.amount, p.currency)}</td>
                    <td>
                      <form action={deleteSupplierPayment}>
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
