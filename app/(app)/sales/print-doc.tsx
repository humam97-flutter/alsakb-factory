import { PrintButton } from "@/components/print-button";
import { money, num } from "@/lib/labels";

type Line = { id: string; description: string; qty: number; unit: string | null; unit_price: number };

// ورقة عرض السعر أو الفاتورة بشعار المعمل
export function PrintDoc({
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
  settings,
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
  settings: { factory_name: string; address: string | null; phone: string | null; invoice_footer: string | null } | null;
}) {
  const th = { color: "#000", background: "#eee" };
  return (
    <div style={{ background: "#fff", color: "#000", padding: 24, borderRadius: 8 }}>
      <div className="noprint actions" style={{ marginTop: 0, marginBottom: 16 }}><PrintButton /></div>
      <div className="row between" style={{ borderBottom: "3px solid #000", paddingBottom: 8, marginBottom: 16, alignItems: "flex-start" }}>
        <div className="row" style={{ gap: 12 }}>
          <div className="logo" aria-hidden="true" style={{ width: 44, height: 44 }} />
          <div>
            <h2 style={{ margin: 0, fontSize: 22 }}>{settings?.factory_name ?? "معمل السكب الحديدي"}</h2>
            {settings?.address && <div style={{ fontSize: 13 }}>{settings.address}</div>}
            {settings?.phone && <div style={{ fontSize: 13 }} className="num">{settings.phone}</div>}
          </div>
        </div>
        <div style={{ textAlign: "end" }}>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{title}</div>
          <div>الرقم: <span className="num">{no}</span></div>
          <div>التاريخ: <span className="num">{day}</span></div>
          {(extra ?? []).filter(([, v]) => v).map(([l, v]) => <div key={l}>{l}: <span className="num">{v}</span></div>)}
        </div>
      </div>
      {customer && (
        <p style={{ marginTop: 0 }}>
          السيد / <b>{customer.name}</b> المحترم
          {customer.phone && <> · <span className="num">{customer.phone}</span></>}
          {customer.address && <> · {customer.address}</>}
        </p>
      )}
      <table style={{ border: "1px solid #999" }}>
        <thead>
          <tr><th style={th}>#</th><th style={th}>الوصف</th><th style={{ ...th, textAlign: "end" }}>الكمية</th><th style={th}>الوحدة</th><th style={{ ...th, textAlign: "end" }}>السعر</th><th style={{ ...th, textAlign: "end" }}>المبلغ</th></tr>
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
      <div className="row" style={{ marginTop: 48, gap: 24 }}>
        {["المحاسب", "المدير", "المستلم"].map((s) => (
          <div key={s} style={{ flex: 1, borderTop: "1px solid #000", paddingTop: 6, textAlign: "center" }}>{s}</div>
        ))}
      </div>
      {settings?.invoice_footer && <p style={{ marginTop: 24, fontSize: 12, textAlign: "center", whiteSpace: "pre-wrap" }}>{settings.invoice_footer}</p>}
    </div>
  );
}
