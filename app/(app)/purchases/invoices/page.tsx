import { cut, Pager, paging } from "@/components/pager";
import Link from "next/link";
import { Alert, type PageProps } from "@/components/ui";
import { can, requireRole } from "@/lib/auth";
import { money, today } from "@/lib/labels";
import { supabase } from "@/lib/supabase/server";

export default async function PurchaseInvoicesPage({ searchParams }: PageProps) {
  await requireRole(can.finance);
  const __sp = await searchParams;
  const { open, from, to, error } = __sp;
  const pg = paging(__sp);
  const db = await supabase();
  let q = db.from("purchase_invoices").select("id, no, day, due_date, currency, supplier_ref, received_at, supplier:suppliers(name)").order("no", { ascending: false }).range(pg.from, pg.to);
  if (from) q = q.gte("day", from);
  if (to) q = q.lte("day", to);
  const { data: invoicesAll } = await q;
  const { rows: invoices, more } = cut(invoicesAll);
  const ids = (invoices ?? []).map((i) => i.id);
  const { data: tot } = ids.length ? await db.from("purchase_totals").select("*").in("invoice_id", ids) : { data: [] };
  const t = new Map((tot ?? []).map((x) => [x.invoice_id, x]));
  let list = invoices ?? [];
  if (open) list = list.filter((i) => Number(t.get(i.id)?.balance ?? 0) > 0);
  const d = today();
  return (
    <>
      <Alert error={error} />
      <form className="bar" method="get">
        <h2>فواتير الشراء</h2>
        <input type="date" name="from" defaultValue={from} aria-label="من" style={{ maxWidth: 160 }} />
        <input type="date" name="to" defaultValue={to} aria-label="إلى" style={{ maxWidth: 160 }} />
        <label className="row" style={{ fontSize: 13 }}>
          <input type="checkbox" name="open" value="1" defaultChecked={!!open} style={{ width: "auto" }} /> غير المسددة بس
        </label>
        <button className="btn ghost" type="submit">عرض</button>
        <Link className="btn" href="/purchases/invoices/new">+ فاتورة شراء</Link>
      </form>
      {!list.length ? (
        <div className="empty">ما بيه فواتير شراء هنا.</div>
      ) : (
        <div className="tbl">
          <table>
            <thead><tr><th>الرقم</th><th>التاريخ</th><th>المورد</th><th>رقم المورد</th><th>المخزن</th><th className="n">الإجمالي</th><th className="n">الباقي</th><th>موعد الدفع</th></tr></thead>
            <tbody>
              {list.map((i) => {
                const x = t.get(i.id);
                const bal = Number(x?.balance ?? 0);
                const late = bal > 0 && i.due_date && i.due_date < d;
                return (
                  <tr key={i.id}>
                    <td className="num"><Link href={`/purchases/invoices/${i.id}`}>#{i.no}</Link></td>
                    <td className="num">{i.day}</td>
                    <td>{(i.supplier as unknown as { name: string }).name}</td>
                    <td className="num">{i.supplier_ref}</td>
                    <td>{i.received_at ? <span className="pill tone-ok">مستلمة</span> : <span className="pill tone-warn">ما دخلت</span>}</td>
                    <td className="n num">{money(x?.total, i.currency)}</td>
                    <td className={`n num ${bal > 0 ? "neg" : ""}`}>{money(bal, i.currency)}</td>
                    <td className={`num ${late ? "tone-bad" : ""}`}>{i.due_date}{late ? " (متأخرة)" : ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <Pager page={pg.page} more={more} sp={__sp} path="/purchases/invoices" />
    </>
  );
}
