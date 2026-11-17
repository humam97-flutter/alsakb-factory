import { LINE_UNITS, money, num } from "@/lib/labels";
import { addLine, deleteLine } from "./actions";
import { PriceCalc } from "./price-calc";

type Line = { id: string; position: number; description: string; qty: number; unit: string | null; unit_price: number };

// بنود العرض أو الفاتورة، مع إضافة بند وحاسبة السعر
export function Lines({
  kind,
  parentId,
  lines,
  currency,
  subtotal,
  discount,
  total,
  editable = true,
}: {
  kind: "quote" | "invoice";
  parentId: string;
  lines: Line[];
  currency: string;
  subtotal: number;
  discount: number;
  total: number;
  editable?: boolean;
}) {
  return (
    <>
      <div className="tbl">
        <table>
          <thead>
            <tr><th>#</th><th>الوصف</th><th className="n">الكمية</th><th>الوحدة</th><th className="n">السعر</th><th className="n">المبلغ</th>{editable && <th></th>}</tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={l.id}>
                <td className="num">{i + 1}</td>
                <td style={{ whiteSpace: "normal", minWidth: 200 }}>{l.description}</td>
                <td className="n num">{num(l.qty)}</td>
                <td>{l.unit}</td>
                <td className="n num">{money(l.unit_price, currency)}</td>
                <td className="n num">{money(Number(l.qty) * Number(l.unit_price), currency)}</td>
                {editable && (
                  <td>
                    <form action={deleteLine}>
                      <input type="hidden" name="kind" value={kind} />
                      <input type="hidden" name="parent_id" value={parentId} />
                      <input type="hidden" name="id" value={l.id} />
                      <button className="btn ghost sm" type="submit" aria-label={`حذف ${l.description}`}>×</button>
                    </form>
                  </td>
                )}
              </tr>
            ))}
            {!lines.length && (
              <tr><td colSpan={7} className="meta">ما بيه بنود بعد. ضيف أول بند من تحت.</td></tr>
            )}
          </tbody>
          <tfoot>
            {discount > 0 && (
              <>
                <tr><td colSpan={5}>المجموع</td><td className="n num">{money(subtotal, currency)}</td>{editable && <td />}</tr>
                <tr><td colSpan={5}>الخصم</td><td className="n num">{money(-discount, currency)}</td>{editable && <td />}</tr>
              </>
            )}
            <tr><td colSpan={5}><b>الإجمالي</b></td><td className="n num"><b>{money(total, currency)}</b></td>{editable && <td />}</tr>
          </tfoot>
        </table>
      </div>
      {editable && (
        <>
          <form action={addLine} className="panel" style={{ marginTop: 10 }}>
            <input type="hidden" name="kind" value={kind} />
            <input type="hidden" name="parent_id" value={parentId} />
            <div className="fields">
              <label className="full">الوصف<input id="line_description" name="description" required placeholder="مثلاً: خزان 5000 لتر صاج 4 ملم" /></label>
              <label>الكمية<input id="line_qty" name="qty" type="number" step="any" inputMode="decimal" defaultValue="1" /></label>
              <label>
                الوحدة
                <select id="line_unit" name="unit" defaultValue="قطعة">
                  {LINE_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </label>
              <label>سعر الوحدة<input id="line_unit_price" name="unit_price" type="number" step="any" inputMode="decimal" /></label>
            </div>
            <div className="actions"><button className="btn" type="submit">+ إضافة البند</button></div>
          </form>
          <PriceCalc />
        </>
      )}
    </>
  );
}
