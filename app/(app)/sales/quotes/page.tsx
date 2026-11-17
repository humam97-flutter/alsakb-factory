import Link from "next/link";
import { Alert, Pill, type PageProps } from "@/components/ui";
import { money, QUOTE_STATUS } from "@/lib/labels";
import { supabase } from "@/lib/supabase/server";

export default async function QuotesPage({ searchParams }: PageProps) {
  const { status, error } = await searchParams;
  const db = await supabase();
  let q = db.from("quotes").select("id, no, day, valid_until, status, currency, order_id, customer:customers(name)").order("no", { ascending: false }).limit(300);
  if (status) q = q.eq("status", status);
  const { data: quotes } = await q;
  const ids = (quotes ?? []).map((x) => x.id);
  const { data: tot } = ids.length ? await db.from("quote_totals").select("quote_id, total").in("quote_id", ids) : { data: [] };
  const total = new Map((tot ?? []).map((t) => [t.quote_id, Number(t.total)]));
  return (
    <>
      <Alert error={error} />
      <form className="bar" method="get">
        <h2>عروض الأسعار</h2>
        <select name="status" defaultValue={status ?? ""} aria-label="الحالة">
          <option value="">الكل</option>
          {Object.entries(QUOTE_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <button className="btn ghost" type="submit">عرض</button>
        <Link className="btn" href="/sales/quotes/new">+ عرض سعر</Link>
      </form>
      {!quotes?.length ? (
        <div className="empty">ما بيه عروض أسعار بعد.</div>
      ) : (
        <div className="tbl">
          <table>
            <thead><tr><th>الرقم</th><th>التاريخ</th><th>الزبون</th><th>الحالة</th><th className="n">المبلغ</th><th>أمر العمل</th></tr></thead>
            <tbody>
              {quotes.map((x) => (
                <tr key={x.id}>
                  <td className="num"><Link href={`/sales/quotes/${x.id}`}>#{x.no}</Link></td>
                  <td className="num">{x.day}</td>
                  <td>{(x.customer as unknown as { name: string } | null)?.name}</td>
                  <td><Pill map={QUOTE_STATUS} value={x.status} /></td>
                  <td className="n num">{money(total.get(x.id) ?? 0, x.currency)}</td>
                  <td>{x.order_id ? <Link href={`/orders/${x.order_id}`}>فتح</Link> : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
