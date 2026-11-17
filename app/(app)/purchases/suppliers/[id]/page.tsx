import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert, type IdPageProps } from "@/components/ui";
import { can, getMe } from "@/lib/auth";
import { money, PAY_METHOD } from "@/lib/labels";
import { supabase } from "@/lib/supabase/server";
import { deleteSupplierPayment } from "../../actions";
import { SupplierPayForm } from "../../supplier-pay-form";
import { SupplierForm } from "../supplier-form";

type Entry = { id: string; day: string; label: React.ReactNode; debit: number; credit: number; currency: string; payId?: string };

export default async function SupplierPage({ params, searchParams }: IdPageProps) {
  const { id } = await params;
  const { error, ok, edit } = await searchParams;
  const me = await getMe();
  const fin = can.finance(me.role);
  const db = await supabase();
  const { data: s } = await db.from("suppliers").select("*").eq("id", id).maybeSingle();
  if (!s) notFound();
  const back = `/purchases/suppliers/${id}`;
  const canEdit = fin || can.stock(me.role);

  let rows: (Entry & { balance: number })[] = [];
  let running: Record<string, number> = {};
  let open: { id: string; label: string }[] = [];
  if (fin) {
    const [{ data: invoices }, { data: tot }, { data: payments }] = await Promise.all([
      db.from("purchase_invoices").select("id, no, day, currency, supplier_ref").eq("supplier_id", id),
      db.from("purchase_totals").select("invoice_id, total, balance").eq("supplier_id", id),
      db.from("supplier_payments").select("*, invoice:purchase_invoices(no)").eq("supplier_id", id),
    ]);
    const t = new Map((tot ?? []).map((x) => [x.invoice_id, x]));
    const entries: Entry[] = [
      ...(invoices ?? []).map((i) => ({
        id: "i" + i.id,
        day: i.day,
        currency: i.currency,
        debit: 0,
        credit: Number(t.get(i.id)?.total ?? 0),
        label: <Link href={`/purchases/invoices/${i.id}`}>فاتورة شراء #{i.no}{i.supplier_ref ? ` (${i.supplier_ref})` : ""}</Link>,
      })),
      ...(payments ?? []).map((p) => ({
        id: "p" + p.id,
        payId: p.id,
        day: p.day,
        currency: p.currency,
        debit: Number(p.amount),
        credit: 0,
        label: `تسديد ${PAY_METHOD[p.method] ?? ""}${p.invoice ? ` على #${(p.invoice as { no: number }).no}` : ""}${p.note ? ` · ${p.note}` : ""}`,
      })),
    ].sort((a, b) => a.day.localeCompare(b.day) || (a.credit ? -1 : 1));
    running = {};
    rows = entries.map((e) => {
      running[e.currency] = (running[e.currency] ?? 0) + e.credit - e.debit;
      return { ...e, balance: running[e.currency] };
    });
    open = (invoices ?? [])
      .filter((i) => Number(t.get(i.id)?.balance ?? 0) > 0)
      .map((i) => ({ id: i.id, label: `#${i.no} · باقي ${money(t.get(i.id)?.balance, i.currency)}` }));
  }

  return (
    <>
      <Alert error={error} ok={ok} />
      <div className="bar">
        <h2>{s.name}</h2>
        {s.phone && <span className="meta num">{s.phone}</span>}
        {s.supplies && <span className="meta">{s.supplies}</span>}
        {canEdit && <Link className="btn ghost" href={edit ? back : `${back}?edit=1`}>{edit ? "إخفاء التعديل" : "تعديل"}</Link>}
        {fin && <Link className="btn ghost" href={`/purchases/invoices/new?supplier=${id}`}>+ فاتورة شراء</Link>}
      </div>
      {edit && canEdit && <SupplierForm s={s} />}
      {s.notes && !edit && <div className="panel" style={{ whiteSpace: "pre-wrap" }}>{s.notes}</div>}

      {fin && (
        <>
          <div className="kpis" style={{ marginTop: 12 }}>
            {Object.keys(running).length === 0 && <div className="kpi"><b>0</b><span>الرصيد</span></div>}
            {Object.entries(running).map(([cur, v]) => (
              <div className="kpi" key={cur}><b className={v > 0 ? "tone-bad" : "tone-ok"}>{money(v, cur)}</b><span>علينا ({cur === "USD" ? "دولار" : "دينار"})</span></div>
            ))}
          </div>
          <h3 className="sec">كشف الحساب</h3>
          {!rows.length ? (
            <div className="empty">ما بيه فواتير أو تسديدات بعد.</div>
          ) : (
            <div className="tbl">
              <table>
                <thead><tr><th>التاريخ</th><th>البيان</th><th className="n">له</th><th className="n">سددنا</th><th className="n">الرصيد</th><th></th></tr></thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td className="num">{r.day}</td>
                      <td>{r.label}</td>
                      <td className="n num">{r.credit ? money(r.credit, r.currency) : ""}</td>
                      <td className="n num pos">{r.debit ? money(r.debit, r.currency) : ""}</td>
                      <td className="n num">{money(r.balance, r.currency)}</td>
                      <td>
                        {r.payId && (
                          <form action={deleteSupplierPayment}>
                            <input type="hidden" name="id" value={r.payId} />
                            <input type="hidden" name="back" value={back} />
                            <button className="btn ghost sm" type="submit" aria-label="حذف التسديد">×</button>
                          </form>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <h3 className="sec">تسجيل تسديد</h3>
          <SupplierPayForm back={back} supplierId={id} invoices={open} />
        </>
      )}
    </>
  );
}
