import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert, type IdPageProps } from "@/components/ui";
import { can, getMe } from "@/lib/auth";
import { money, QUOTE_STATUS } from "@/lib/labels";
import { waLink } from "@/lib/share";
import { supabase } from "@/lib/supabase/server";
import { deleteQuote, invoiceFrom, quoteToOrder, setQuoteStatus } from "../../actions";
import { HeadForm } from "../../head-form";
import { Lines } from "../../lines";

export default async function QuotePage({ params, searchParams }: IdPageProps) {
  const { id } = await params;
  const { error, edit } = await searchParams;
  const me = await getMe();
  const db = await supabase();
  const [{ data: q }, { data: lines }, { data: tot }, { data: customers }, { data: settings }] = await Promise.all([
    db.from("quotes").select("*, customer:customers(name, phone)").eq("id", id).maybeSingle(),
    db.from("quote_lines").select("*").eq("quote_id", id).order("position"),
    db.from("quote_totals").select("*").eq("quote_id", id).maybeSingle(),
    db.from("customers").select("id, name").order("name"),
    db.from("settings").select("factory_name").eq("id", 1).maybeSingle(),
  ]);
  if (!q) notFound();
  const c = q.customer as { name: string; phone: string | null } | null;
  const total = Number(tot?.total ?? 0);
  const { data: inv } = await db.from("invoices").select("id, no").eq("quote_id", id).limit(1).maybeSingle();
  const msg =
    `${settings?.factory_name ?? "معمل السكب الحديدي"}\nعرض سعر رقم ${q.no}${c ? ` للسيد ${c.name}` : ""}\n` +
    (lines ?? []).map((l) => `- ${l.description}: ${l.qty} ${l.unit ?? ""} × ${money(l.unit_price, q.currency)}`).join("\n") +
    `\nالإجمالي: ${money(total, q.currency)}` +
    (q.valid_until ? `\nالعرض صالح لغاية ${q.valid_until}` : "");

  return (
    <>
      <Alert error={error} />
      <div className="bar">
        <h2>عرض سعر #{q.no}{c ? ` · ${c.name}` : ""}</h2>
        <Link className="btn ghost" href={edit ? `/sales/quotes/${id}` : `/sales/quotes/${id}?edit=1`}>{edit ? "إخفاء التعديل" : "تعديل الرأس"}</Link>
        <Link className="btn ghost" href={`/sales/quotes/${id}/print`}>طباعة</Link>
        <a className="btn ghost" target="_blank" rel="noopener" href={waLink(c?.phone, msg)}>إرسال بالواتساب</a>
      </div>

      <form action={setQuoteStatus} className="seg" role="group" aria-label="الحالة" style={{ marginBottom: 10 }}>
        <input type="hidden" name="id" value={q.id} />
        {Object.entries(QUOTE_STATUS).map(([k, v]) => (
          <button key={k} type="submit" name="status" value={k} className={`tone-${v.tone}`} aria-pressed={q.status === k}>{v.label}</button>
        ))}
      </form>

      {edit && <HeadForm kind="quote" r={q} customers={customers ?? []} />}
      {q.notes && !edit && <div className="panel" style={{ whiteSpace: "pre-wrap", marginBottom: 10 }}>{q.notes}</div>}

      <Lines
        kind="quote"
        parentId={q.id}
        lines={lines ?? []}
        currency={q.currency}
        subtotal={Number(tot?.subtotal ?? 0)}
        discount={Number(q.discount)}
        total={total}
      />

      <div className="actions">
        {q.order_id ? (
          <Link className="btn ghost" href={`/orders/${q.order_id}`}>فتح أمر العمل</Link>
        ) : (
          can.production(me.role) && (
            <form action={quoteToOrder}>
              <input type="hidden" name="id" value={q.id} />
              <button className="btn" type="submit" disabled={!lines?.length}>تحويل لأمر عمل</button>
            </form>
          )
        )}
        {inv ? (
          <Link className="btn ghost" href={`/sales/invoices/${inv.id}`}>فاتورة #{inv.no}</Link>
        ) : (
          <form action={invoiceFrom}>
            <input type="hidden" name="quote_id" value={q.id} />
            <button className="btn ghost" type="submit" disabled={!lines?.length || !q.customer_id}>إصدار فاتورة من العرض</button>
          </form>
        )}
      </div>

      <form action={deleteQuote} className="panel row" style={{ marginTop: 24 }}>
        <input type="hidden" name="id" value={q.id} />
        <label className="row" style={{ fontSize: 13 }}>
          <input type="checkbox" name="confirm" value="yes" style={{ width: "auto" }} /> أؤكد حذف العرض
        </label>
        <button className="btn danger" type="submit">حذف</button>
      </form>
    </>
  );
}
