import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert, type IdPageProps } from "@/components/ui";
import { can, requireRole } from "@/lib/auth";
import { money, num, PAY_METHOD } from "@/lib/labels";
import { supabase } from "@/lib/supabase/server";
import { addPurchaseLine, deletePurchase, deletePurchaseLine, deleteSupplierPayment, receivePurchase } from "../../actions";
import { SupplierPayForm } from "../../supplier-pay-form";
import { PurchaseHeadForm } from "../head-form";

export default async function PurchaseInvoicePage({ params, searchParams }: IdPageProps) {
  await requireRole(can.finance);
  const { id } = await params;
  const { error, ok, edit } = await searchParams;
  const db = await supabase();
  const [{ data: inv }, { data: lines }, { data: tot }, { data: payments }, { data: suppliers }, { data: materials }] = await Promise.all([
    db.from("purchase_invoices").select("*, supplier:suppliers(id, name)").eq("id", id).maybeSingle(),
    db.from("purchase_lines").select("*, material:materials(name, currency)").eq("invoice_id", id).order("position"),
    db.from("purchase_totals").select("*").eq("invoice_id", id).maybeSingle(),
    db.from("supplier_payments").select("*").eq("invoice_id", id).order("day"),
    db.from("suppliers").select("id, name").order("name"),
    db.from("materials").select("id, name, spec, unit, unit_price, currency").order("name"),
  ]);
  if (!inv) notFound();
  const s = inv.supplier as { id: string; name: string };
  const total = Number(tot?.total ?? 0);
  const balance = Number(tot?.balance ?? 0);
  const back = `/purchases/invoices/${id}`;
  const stockLines = (lines ?? []).filter((l) => l.material_id);

  return (
    <>
      <Alert error={error} ok={ok} />
      <div className="bar">
        <h2>فاتورة شراء #{inv.no} · <Link href={`/purchases/suppliers/${s.id}`}>{s.name}</Link></h2>
        {inv.supplier_ref && <span className="meta">رقم المورد: {inv.supplier_ref}</span>}
        <Link className="btn ghost" href={edit ? back : `${back}?edit=1`}>{edit ? "إخفاء التعديل" : "تعديل الرأس"}</Link>
      </div>
      {edit && <PurchaseHeadForm r={inv} suppliers={suppliers ?? []} />}

      <div className="kpis" style={{ marginBottom: 12 }}>
        <div className="kpi"><b>{money(total, inv.currency)}</b><span>الإجمالي</span></div>
        <div className="kpi"><b className="tone-ok">{money(tot?.paid, inv.currency)}</b><span>سددنا</span></div>
        <div className="kpi"><b className={balance > 0 ? "tone-bad" : ""}>{money(balance, inv.currency)}</b><span>الباقي علينا</span></div>
      </div>

      <div className="tbl">
        <table>
          <thead><tr><th>#</th><th>البند</th><th>المخزن</th><th className="n">الكمية</th><th className="n">السعر</th><th className="n">المبلغ</th><th></th></tr></thead>
          <tbody>
            {(lines ?? []).map((l, i) => (
              <tr key={l.id}>
                <td className="num">{i + 1}</td>
                <td style={{ whiteSpace: "normal", minWidth: 180 }}>{l.description}</td>
                <td>{l.material_id ? <span className="pill tone-info">مادة</span> : <span className="meta">مصروف</span>}</td>
                <td className="n num">{num(l.qty)} {l.unit}</td>
                <td className="n num">{money(l.unit_price, inv.currency)}</td>
                <td className="n num">{money(Number(l.qty) * Number(l.unit_price), inv.currency)}</td>
                <td>
                  {!(inv.received_at && l.material_id) && (
                    <form action={deletePurchaseLine}>
                      <input type="hidden" name="invoice_id" value={inv.id} />
                      <input type="hidden" name="id" value={l.id} />
                      <button className="btn ghost sm" type="submit" aria-label={`حذف ${l.description}`}>×</button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
            {!lines?.length && <tr><td colSpan={7} className="meta">ضيف البنود من تحت.</td></tr>}
          </tbody>
          <tfoot>
            {Number(inv.discount) > 0 && (
              <tr><td colSpan={5}>الخصم</td><td className="n num">{money(-Number(inv.discount), inv.currency)}</td><td /></tr>
            )}
            <tr><td colSpan={5}><b>الإجمالي</b></td><td className="n num"><b>{money(total, inv.currency)}</b></td><td /></tr>
          </tfoot>
        </table>
      </div>

      <form action={addPurchaseLine} className="panel" style={{ marginTop: 10 }}>
        <input type="hidden" name="invoice_id" value={inv.id} />
        <div className="fields">
          <label className="full">
            مادة من المخزن (تدخل المخزن ويتحدث سعرها)
            <select name="material_id" defaultValue="">
              <option value="">— مصروف أو خدمة (نقل، قص، صيانة...) —</option>
              {(materials ?? []).map((m) => (
                <option key={m.id} value={m.id}>{m.name}{m.spec ? ` · ${m.spec}` : ""} ({m.unit}، آخر سعر {money(m.unit_price, m.currency)})</option>
              ))}
            </select>
          </label>
          <label className="full">الوصف (اختياري للمادة)<input name="description" /></label>
          <label>الكمية<input name="qty" type="number" step="any" inputMode="decimal" required /></label>
          <label>سعر الوحدة ({inv.currency === "USD" ? "دولار" : "دينار"})<input name="unit_price" type="number" step="any" inputMode="decimal" required /></label>
        </div>
        <div className="actions"><button className="btn" type="submit">+ إضافة البند</button></div>
      </form>

      <div className="panel row between" style={{ marginTop: 10 }}>
        {inv.received_at ? (
          <span className="tone-ok">دخلت المواد للمخزن بتاريخ <span className="num">{inv.received_at.slice(0, 10)}</span>.</span>
        ) : (
          <>
            <span>{stockLines.length ? `${stockLines.length} مادة جاهزة تدخل المخزن.` : "ما بيه مواد مخزن بهذه الفاتورة."}</span>
            {stockLines.length > 0 && (
              <form action={receivePurchase}>
                <input type="hidden" name="id" value={inv.id} />
                <button className="btn" type="submit">استلام المواد للمخزن</button>
              </form>
            )}
          </>
        )}
      </div>

      <h3 className="sec">التسديدات</h3>
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
                    <form action={deleteSupplierPayment}>
                      <input type="hidden" name="id" value={p.id} />
                      <input type="hidden" name="back" value={back} />
                      <button className="btn ghost sm" type="submit" aria-label="حذف">×</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {balance > 0 && <SupplierPayForm back={back} supplierId={s.id} invoiceId={inv.id} currency={inv.currency} amount={balance} />}

      <form action={deletePurchase} className="panel row" style={{ marginTop: 24 }}>
        <input type="hidden" name="id" value={inv.id} />
        <label className="row" style={{ fontSize: 13 }}>
          <input type="checkbox" name="confirm" value="yes" style={{ width: "auto" }} /> أؤكد حذف الفاتورة{inv.received_at ? " (المواد تنسحب من المخزن)" : ""}
        </label>
        <button className="btn danger" type="submit">حذف</button>
      </form>
    </>
  );
}
