import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert, type IdPageProps } from "@/components/ui";
import { money, PAY_METHOD } from "@/lib/labels";
import { waLink } from "@/lib/share";
import { supabase } from "@/lib/supabase/server";
import { deleteInvoice, deletePayment } from "../../actions";
import { HeadForm } from "../../head-form";
import { Lines } from "../../lines";
import { PaymentForm } from "../../payment-form";

export default async function InvoicePage({ params, searchParams }: IdPageProps) {
  const { id } = await params;
  const { error, ok, edit } = await searchParams;
  const db = await supabase();
  const [{ data: inv }, { data: lines }, { data: tot }, { data: payments }, { data: customers }, { data: orders }, { data: settings }] = await Promise.all([
    db.from("invoices").select("*, customer:customers(id, name, phone), order:work_orders(id, no, product)").eq("id", id).maybeSingle(),
    db.from("invoice_lines").select("*").eq("invoice_id", id).order("position"),
    db.from("invoice_totals").select("*").eq("invoice_id", id).maybeSingle(),
    db.from("customer_payments").select("*").eq("invoice_id", id).order("day"),
    db.from("customers").select("id, name").order("name"),
    db.from("work_orders").select("id, no, product").order("no", { ascending: false }).limit(300),
    db.from("settings").select("factory_name").eq("id", 1).maybeSingle(),
  ]);
  if (!inv) notFound();
  const c = inv.customer as { id: string; name: string; phone: string | null };
  const o = inv.order as { id: string; no: number; product: string } | null;
  const total = Number(tot?.total ?? 0);
  const paid = Number(tot?.paid ?? 0);
  const balance = Number(tot?.balance ?? 0);
  const back = `/sales/invoices/${id}`;
  const msg =
    `${settings?.factory_name ?? "معمل السكب الحديدي"}\nفاتورة رقم ${inv.no} بتاريخ ${inv.day}\nالسيد ${c.name} المحترم\n` +
    (lines ?? []).map((l) => `- ${l.description}: ${l.qty} ${l.unit ?? ""}`).join("\n") +
    `\nالإجمالي: ${money(total, inv.currency)}` +
    (paid ? `\nالمدفوع: ${money(paid, inv.currency)}\nالباقي: ${money(balance, inv.currency)}` : "");

  return (
    <>
      <Alert error={error} ok={ok} />
      <div className="bar">
        <h2>فاتورة #{inv.no} · <Link href={`/sales/customers/${c.id}`}>{c.name}</Link></h2>
        {inv.cancelled && <span className="pill tone-bad">ملغاة</span>}
        <Link className="btn ghost" href={edit ? back : `${back}?edit=1`}>{edit ? "إخفاء التعديل" : "تعديل الرأس"}</Link>
        <Link className="btn ghost" href={`${back}/print`}>طباعة</Link>
        <a className="btn ghost" target="_blank" rel="noopener" href={waLink(c.phone, msg)}>إرسال بالواتساب</a>
      </div>
      {o && <p className="meta">أمر العمل: <Link href={`/orders/${o.id}`}>#{o.no} · {o.product}</Link></p>}
      {edit && (
        <HeadForm kind="invoice" r={inv} customers={customers ?? []} orders={(orders ?? []).map((x) => ({ id: x.id, label: `#${x.no} · ${x.product}` }))} />
      )}

      <div className="kpis" style={{ marginBottom: 12 }}>
        <div className="kpi"><b>{money(total, inv.currency)}</b><span>الإجمالي</span></div>
        <div className="kpi"><b className="tone-ok">{money(paid, inv.currency)}</b><span>المدفوع</span></div>
        <div className="kpi"><b className={balance > 0 ? "tone-bad" : ""}>{money(balance, inv.currency)}</b><span>الباقي</span></div>
      </div>

      <Lines
        kind="invoice"
        parentId={inv.id}
        lines={lines ?? []}
        currency={inv.currency}
        subtotal={Number(tot?.subtotal ?? 0)}
        discount={Number(inv.discount)}
        total={total}
      />

      <h3 className="sec">المقبوضات على هذه الفاتورة</h3>
      {payments?.length ? (
        <div className="tbl" style={{ marginBottom: 10 }}>
          <table>
            <thead><tr><th>التاريخ</th><th>الطريقة</th><th>ملاحظة</th><th className="n">المبلغ</th><th></th></tr></thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id}>
                  <td className="num">{p.day}</td>
                  <td>{PAY_METHOD[p.method]}</td>
                  <td>{p.note}</td>
                  <td className="n num">{money(p.amount, p.currency)}</td>
                  <td>
                    <form action={deletePayment}>
                      <input type="hidden" name="id" value={p.id} />
                      <input type="hidden" name="back" value={back} />
                      <button className="btn ghost sm" type="submit" aria-label="حذف القبض">×</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {!inv.cancelled && balance > 0 && (
        <PaymentForm back={back} customerId={c.id} invoiceId={inv.id} currency={inv.currency} amount={balance} />
      )}

      <form action={deleteInvoice} className="panel row" style={{ marginTop: 24 }}>
        <input type="hidden" name="id" value={inv.id} />
        <label className="row" style={{ fontSize: 13 }}>
          <input type="checkbox" name="confirm" value="yes" style={{ width: "auto" }} /> أؤكد حذف الفاتورة
        </label>
        <button className="btn danger" type="submit">حذف</button>
      </form>
    </>
  );
}
