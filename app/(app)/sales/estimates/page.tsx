import Link from "next/link";
import { Alert, type PageProps } from "@/components/ui";
import { EST_STATUS, PRODUCT_TYPE } from "@/lib/estimate";
import { money, num } from "@/lib/labels";
import { supabase } from "@/lib/supabase/server";


export default async function EstimatesPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const db = await supabase();
  let q = db.from("estimates").select("id, no, title, product_type, weight_kg, qty, status, currency, order_id, quote_id, created_at, customer:customers(name)").order("no", { ascending: false }).limit(300);
  if (sp.status) q = q.eq("status", sp.status);
  const { data } = await q;
  const rows = data ?? [];
  const ids = rows.map((r) => r.id);
  const orderIds = rows.map((r) => r.order_id).filter(Boolean) as string[];
  const [{ data: tot }, { data: costs }] = await Promise.all([
    ids.length ? db.from("estimate_totals").select("estimate_id, cost, price").in("estimate_id", ids) : Promise.resolve({ data: [] as { estimate_id: string; cost: number; price: number }[] }),
    orderIds.length ? db.from("work_order_costs").select("order_id, cost_total").in("order_id", orderIds) : Promise.resolve({ data: [] as { order_id: string; cost_total: number }[] }),
  ]);
  const T = new Map((tot ?? []).map((t) => [t.estimate_id, t]));
  const C = new Map((costs ?? []).map((c) => [c.order_id, Number(c.cost_total)]));
  const won = rows.filter((r) => r.status === "won").length, lost = rows.filter((r) => r.status === "lost").length;

  return (
    <>
      <Alert error={sp.error} ok={sp.ok} />
      <form className="bar" method="get">
        <h2>التسعير التقديري</h2>
        <select name="status" defaultValue={sp.status ?? ""} aria-label="الحالة" style={{ width: 150 }}>
          <option value="">الكل</option>
          {Object.entries(EST_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <button className="btn ghost" type="submit">عرض</button>
        <Link className="btn ghost" href="/sales/estimates/rates">أسعار الكلف</Link>
        <Link className="btn" href="/sales/estimates/new">+ تقدير جديد</Link>
      </form>
      {won + lost > 0 && <p className="meta">نسبة الفوز بالعروض: <b className="num">{Math.round((won / (won + lost)) * 100)}%</b> ({won} من {won + lost})</p>}
      {!rows.length ? (
        <div className="empty">ما بيه تقديرات بعد. ابدي من «+ تقدير جديد»، أو احسب وعاء أو خزان من الحاسبات الهندسية واحفظه أولاً.</div>
      ) : (
        <div className="tbl">
          <table>
            <thead><tr><th>الرقم</th><th>العنوان</th><th>الزبون</th><th>النوع</th><th className="n">الوزن</th><th className="n">الكلفة</th><th className="n">السعر</th><th className="n">الفعلي</th><th>الحالة</th></tr></thead>
            <tbody>
              {rows.map((r) => {
                const t = T.get(r.id);
                const act = r.order_id ? C.get(r.order_id) : undefined;
                const diff = act !== undefined && t ? ((act - Number(t.cost)) / Number(t.cost || 1)) * 100 : null;
                return (
                  <tr key={r.id}>
                    <td className="num"><Link href={`/sales/estimates/${r.id}`}>#{r.no}</Link></td>
                    <td><Link href={`/sales/estimates/${r.id}`}>{r.title}</Link>{r.qty > 1 && <span className="meta"> × {r.qty}</span>}</td>
                    <td>{(r.customer as unknown as { name: string } | null)?.name}</td>
                    <td>{PRODUCT_TYPE[r.product_type]}</td>
                    <td className="n num">{r.weight_kg ? `${num(Math.round(Number(r.weight_kg) * r.qty))} كغم` : ""}</td>
                    <td className="n num">{money(t?.cost, r.currency)}</td>
                    <td className="n num">{money(t?.price, r.currency)}</td>
                    <td className={`n num ${diff !== null && diff > 5 ? "neg" : ""}`}>{act !== undefined ? `${money(act, r.currency)} (${diff! > 0 ? "+" : ""}${diff!.toFixed(0)}%)` : ""}</td>
                    <td><span className={`pill tone-${EST_STATUS[r.status]?.tone}`}>{EST_STATUS[r.status]?.label}</span></td>
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
