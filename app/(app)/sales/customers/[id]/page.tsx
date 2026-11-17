import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert, Pill, type IdPageProps } from "@/components/ui";
import { money, ORDER_STATUS, PAY_METHOD, QUOTE_STATUS } from "@/lib/labels";
import { waLink } from "@/lib/share";
import { supabase } from "@/lib/supabase/server";
import { deletePayment } from "../../actions";
import { PaymentForm } from "../../payment-form";
import { CustomerForm } from "../customer-form";

type Entry = { day: string; label: React.ReactNode; debit: number; credit: number; currency: string; id: string; payId?: string };

export default async function CustomerPage({ params, searchParams }: IdPageProps) {
  const { id } = await params;
  const { error, ok, edit } = await searchParams;
  const db = await supabase();
  const [{ data: c }, { data: invoices }, { data: payments }, { data: orders }, { data: quotes }, { data: settings }, { data: itot }] = await Promise.all([
    db.from("customers").select("*").eq("id", id).maybeSingle(),
    db.from("invoices").select("id, no, day, currency, cancelled").eq("customer_id", id).order("day"),
    db.from("customer_payments").select("*, invoice:invoices(no)").eq("customer_id", id).order("day"),
    db.from("work_orders").select("id, no, product, status, due_date").eq("customer_id", id).order("no", { ascending: false }),
    db.from("quotes").select("id, no, day, status, currency").eq("customer_id", id).order("no", { ascending: false }),
    db.from("settings").select("factory_name").eq("id", 1).maybeSingle(),
    db.from("invoice_totals").select("invoice_id, total, balance").eq("customer_id", id),
  ]);
  const qids = (quotes ?? []).map((q) => q.id);
  const { data: qtot } = qids.length ? await db.from("quote_totals").select("quote_id, total").in("quote_id", qids) : { data: [] };
  const invTot = new Map((itot ?? []).map((t) => [t.invoice_id, t]));
  const quoteTot = new Map((qtot ?? []).map((t) => [t.quote_id, Number(t.total)]));
  if (!c) notFound();

  const entries: Entry[] = [
    ...(invoices ?? [])
      .filter((i) => !i.cancelled)
      .map((i) => ({
        id: "i" + i.id,
        day: i.day,
        currency: i.currency,
        debit: Number(invTot.get(i.id)?.total ?? 0),
        credit: 0,
        label: <Link href={`/sales/invoices/${i.id}`}>فاتورة #{i.no}</Link>,
      })),
    ...(payments ?? []).map((p) => ({
      id: "p" + p.id,
      payId: p.id,
      day: p.day,
      currency: p.currency,
      debit: 0,
      credit: Number(p.amount),
      label: `قبض ${PAY_METHOD[p.method] ?? ""}${p.invoice ? ` على فاتورة #${(p.invoice as { no: number }).no}` : ""}${p.note ? ` · ${p.note}` : ""}`,
    })),
  ].sort((a, b) => a.day.localeCompare(b.day) || (a.debit ? -1 : 1));

  const running: Record<string, number> = {};
  const rows = entries.map((e) => {
    running[e.currency] = (running[e.currency] ?? 0) + e.debit - e.credit;
    return { ...e, balance: running[e.currency] };
  });
  const back = `/sales/customers/${id}`;
  const open = (invoices ?? []).filter((i) => !i.cancelled && Number(invTot.get(i.id)?.balance ?? 0) > 0);
  const balanceText = Object.entries(running)
    .filter(([, v]) => v !== 0)
    .map(([cur, v]) => money(v, cur))
    .join(" + ");

  return (
    <>
      <Alert error={error} ok={ok} />
      <div className="bar">
        <h2>{c.name}</h2>
        {c.phone && <span className="meta num">{c.phone}</span>}
        <Link className="btn ghost" href={edit ? back : `${back}?edit=1`}>{edit ? "إخفاء التعديل" : "تعديل"}</Link>
        <Link className="btn ghost" href={`/sales/quotes/new?customer=${id}`}>+ عرض سعر</Link>
        <Link className="btn ghost" href={`/sales/invoices/new?customer=${id}`}>+ فاتورة</Link>
        {balanceText && (
          <a
            className="btn ghost"
            target="_blank"
            rel="noopener"
            href={waLink(c.phone, `${settings?.factory_name ?? "معمل السكب الحديدي"}\nالسيد ${c.name} المحترم\nرصيد حسابكم لدينا: ${balanceText}\nمع التقدير.`)}
          >
            إرسال الرصيد بالواتساب
          </a>
        )}
      </div>
      {edit && <CustomerForm c={c} />}

      <div className="kpis">
        {Object.keys(running).length === 0 && <div className="kpi"><b>0</b><span>الرصيد</span></div>}
        {Object.entries(running).map(([cur, v]) => (
          <div className="kpi" key={cur}><b className={v > 0 ? "tone-bad" : "tone-ok"}>{money(v, cur)}</b><span>الباقي عليه ({cur === "USD" ? "دولار" : "دينار"})</span></div>
        ))}
      </div>

      <h3 className="sec">كشف الحساب</h3>
      {!rows.length ? (
        <div className="empty">ما بيه فواتير أو مقبوضات بعد.</div>
      ) : (
        <div className="tbl">
          <table>
            <thead><tr><th>التاريخ</th><th>البيان</th><th className="n">عليه</th><th className="n">دفع</th><th className="n">الرصيد</th><th></th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="num">{r.day}</td>
                  <td>{r.label}</td>
                  <td className="n num">{r.debit ? money(r.debit, r.currency) : ""}</td>
                  <td className="n num pos">{r.credit ? money(r.credit, r.currency) : ""}</td>
                  <td className="n num">{money(r.balance, r.currency)}</td>
                  <td>
                    {r.payId && (
                      <form action={deletePayment}>
                        <input type="hidden" name="id" value={r.payId} />
                        <input type="hidden" name="back" value={back} />
                        <button className="btn ghost sm" type="submit" aria-label="حذف القبض">×</button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h3 className="sec">تسجيل قبض</h3>
      <PaymentForm
        back={back}
        customerId={id}
        invoices={open.map((i) => ({ id: i.id, label: `فاتورة #${i.no} · باقي ${money(invTot.get(i.id)?.balance, i.currency)}` }))}
      />

      {(orders?.length ?? 0) > 0 && (
        <>
          <h3 className="sec">أوامر العمل</h3>
          <div className="tbl">
            <table>
              <thead><tr><th>الرقم</th><th>المنتج</th><th>الحالة</th><th>التسليم</th></tr></thead>
              <tbody>
                {orders!.map((o) => (
                  <tr key={o.id}>
                    <td className="num"><Link href={`/orders/${o.id}`}>#{o.no}</Link></td>
                    <td>{o.product}</td>
                    <td><Pill map={ORDER_STATUS} value={o.status} /></td>
                    <td className="num">{o.due_date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {(quotes?.length ?? 0) > 0 && (
        <>
          <h3 className="sec">عروض الأسعار</h3>
          <div className="tbl">
            <table>
              <thead><tr><th>الرقم</th><th>التاريخ</th><th>الحالة</th><th className="n">المبلغ</th></tr></thead>
              <tbody>
                {quotes!.map((q) => (
                  <tr key={q.id}>
                    <td className="num"><Link href={`/sales/quotes/${q.id}`}>#{q.no}</Link></td>
                    <td className="num">{q.day}</td>
                    <td><Pill map={QUOTE_STATUS} value={q.status} /></td>
                    <td className="n num">{money(quoteTot.get(q.id), q.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
