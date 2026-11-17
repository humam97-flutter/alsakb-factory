import { PrintButton } from "@/components/print-button";
import { Letterhead, Signatures } from "@/components/letterhead";
import { getBrand } from "@/lib/brand";
import { money, num } from "@/lib/labels";

type Line = { id: string; description: string; qty: number; unit: string | null; unit_price: number };

// ورقة عرض السعر أو الفاتورة بشعار المعمل
export async function PrintDoc({
  title,
  no,
  day,
  extra,
  customer,
  lines,
  currency,
  subtotal,
  discount,
  total,
  paid,
  notes,
}: {
  title: string;
  no: number;
  day: string;
  extra?: [string, string | null][];
  customer: { name: string; phone: string | null; address?: string | null } | null;
  lines: Line[];
  currency: string;
  subtotal: number;
  discount: number;
  total: number;
  paid?: number;
  notes?: string | null;
  settings?: unknown;
}) {
  const brand = await getBrand();
  return (
    <div className="paper">
      <div className="noprint actions" style={{ marginTop: 0, marginBottom: 16, paddingTop: 0, borderTop: 0 }}><PrintButton /></div>
      <Letterhead brand={brand} title={title} info={[["الرقم", no], ["التاريخ", day], ...(extra ?? [])]} />
      {customer && (
        <p style={{ marginTop: 0 }}>
          السيد / <b>{customer.name}</b> المحترم
          {customer.phone && <> · <span className="num">{customer.phone}</span></>}
          {customer.address && <> · {customer.address}</>}
        </p>
      )}
      <table>
        <thead>
          <tr><th>#</th><th>الوصف</th><th className="n">الكمية</th><th>الوحدة</th><th className="n">السعر</th><th className="n">المبلغ</th></tr>
        </thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={l.id}>
              <td>{i + 1}</td>
              <td style={{ whiteSpace: "normal" }}>{l.description}</td>
              <td className="n num">{num(l.qty)}</td>
              <td>{l.unit}</td>
              <td className="n num">{money(l.unit_price, currency)}</td>
              <td className="n num">{money(Number(l.qty) * Number(l.unit_price), currency)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          {discount > 0 && (
            <>
              <tr><td colSpan={5}>المجموع</td><td className="n num">{money(subtotal, currency)}</td></tr>
              <tr><td colSpan={5}>الخصم</td><td className="n num">{money(-discount, currency)}</td></tr>
            </>
          )}
          <tr><td colSpan={5}><b>الإجمالي</b></td><td className="n num"><b>{money(total, currency)}</b></td></tr>
          {paid !== undefined && paid > 0 && (
            <>
              <tr><td colSpan={5}>المدفوع</td><td className="n num">{money(paid, currency)}</td></tr>
              <tr><td colSpan={5}><b>الباقي</b></td><td className="n num"><b>{money(total - paid, currency)}</b></td></tr>
            </>
          )}
        </tfoot>
      </table>
      {notes && <div style={{ whiteSpace: "pre-wrap", marginTop: 14, border: "1px solid #999", padding: 8 }}>{notes}</div>}
      <Signatures names={["المحاسب", "المدير", "المستلم"]} manager={brand.manager_name} />
      {brand.footer && <div className="paper-foot">{brand.footer}</div>}
    </div>
  );
}
