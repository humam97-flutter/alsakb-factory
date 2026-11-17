import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert, type IdPageProps } from "@/components/ui";
import { PrintButton } from "@/components/print-button";
import { StackBar } from "@/components/charts";
import { CATEGORY, EST_STATUS, PRODUCT_TYPE } from "@/lib/estimate";
import { money, num } from "@/lib/labels";
import { supabase } from "@/lib/supabase/server";
import { addEstLine, deleteEstimate, deleteEstLine, estimateToQuote, regenerate, saveEstimate, updateEstLine } from "../actions";

export default async function EstimatePage({ params, searchParams }: IdPageProps) {
  const { id } = await params;
  const sp = await searchParams;
  const db = await supabase();
  const [{ data: e }, { data: lines }, { data: t }] = await Promise.all([
    db.from("estimates").select("*, customer:customers(name), calc:calcs(id, kind, title, inputs), quote:quotes(no), order:work_orders(no)").eq("id", id).maybeSingle(),
    db.from("estimate_lines").select("*").eq("estimate_id", id).order("position"),
    db.from("estimate_totals").select("*").eq("estimate_id", id).maybeSingle(),
  ]);
  if (!e) notFound();
  const { data: act } = e.order_id ? await db.from("work_order_costs").select("*").eq("order_id", e.order_id).maybeSingle() : { data: null };
  const cur = e.currency;
  const ls = lines ?? [];
  const cats = Object.keys(CATEGORY).filter((c) => ls.some((l) => l.category === c));
  const sum = (c: string) => ls.filter((l) => l.category === c).reduce((a, l) => a + Number(l.qty) * Number(l.unit_cost), 0);
  const direct = Number(t?.direct ?? 0), cost = Number(t?.cost ?? 0), price = Number(t?.price ?? 0);
  const kg = Number(e.weight_kg ?? 0) * e.qty;
  const calc = e.calc as { id: string; kind: string; title: string; inputs: Record<string, string> } | null;
  const quote = e.quote as { no: number } | null;
  const order = e.order as { no: number } | null;
  const tone = ["var(--primary)", "var(--accent)", "var(--ok)", "var(--warn)", "var(--info)", "var(--bad)", "var(--mut)"];

  return (
    <>
      <Alert error={sp.error} ok={sp.ok} />
      <div className="bar">
        <h2>تقدير #{e.no} · {e.title}</h2>
        <span className={`pill tone-${EST_STATUS[e.status]?.tone}`}>{EST_STATUS[e.status]?.label}</span>
      </div>
      <div className="actions noprint" style={{ marginTop: 0, marginBottom: 14 }}>
        {quote ? <Link className="btn ghost" href={`/sales/quotes/${e.quote_id}`}>عرض السعر #{quote.no}</Link> : (
          <form action={estimateToQuote}><input type="hidden" name="id" value={e.id} /><button className="btn" type="submit">تحويل لعرض سعر</button></form>
        )}
        {order && <Link className="btn ghost" href={`/orders/${e.order_id}`}>أمر العمل #{order.no}</Link>}
        {calc && <Link className="btn ghost" href={`/tools/engineering${calc.kind === "tank" ? "/tank" : ""}?${new URLSearchParams(calc.inputs).toString()}`}>الحساب الهندسي</Link>}
        {(calc || e.weight_kg) && (
          <form action={regenerate}><input type="hidden" name="id" value={e.id} /><button className="btn ghost" type="submit" data-confirm="البنود الحالية تنمسح وتنولد من جديد بالأسعار الحالية. تكمل؟">ولّد البنود من جديد</button></form>
        )}
        <PrintButton />
      </div>

      <div className="kpis">
        <div className="kpi"><span>الكلفة المباشرة</span><b>{money(direct, cur)}</b></div>
        <div className="kpi"><span>الكلفة الكلية</span><b>{money(cost, cur)}</b></div>
        <div className="kpi"><span>سعر البيع{e.qty > 1 ? ` (${e.qty} قطع)` : ""}</span><b>{money(price, cur)}</b></div>
        <div className="kpi"><span>الربح المتوقع</span><b>{money(price - cost, cur)}</b></div>
        {kg > 0 && <div className="kpi"><span>السعر لكل كغم</span><b>{money(price / kg, cur)}</b></div>}
      </div>

      {direct > 0 && (
        <div className="panel" style={{ marginBottom: 14 }}>
          <b>توزيع الكلفة المباشرة</b>
          <StackBar parts={cats.map((c, i) => ({ label: CATEGORY[c], value: sum(c), color: tone[i % tone.length] }))} />
        </div>
      )}

      {cats.map((c) => (
        <div key={c}>
          <h3 className="sec">{CATEGORY[c]} <span className="meta">{money(sum(c), cur)}</span></h3>
          <div className="tbl">
            <table data-plain>
              <thead><tr><th>البند</th><th className="n" colSpan={3}>الكمية · الوحدة · سعر الوحدة</th><th className="n">المبلغ</th><th className="noprint"></th></tr></thead>
              <tbody>
                {ls.filter((l) => l.category === c).map((l) => (
                  <tr key={l.id}>
                    <td>{l.description}</td>
                    <td className="n" colSpan={3}>
                      <form action={updateEstLine} className="row" style={{ gap: 4, justifyContent: "flex-end", flexWrap: "nowrap" }}>
                        <input type="hidden" name="estimate_id" value={e.id} />
                        <input type="hidden" name="line_id" value={l.id} />
                        <input name="qty" type="number" step="any" defaultValue={Number(l.qty)} aria-label="الكمية" style={{ width: 90 }} />
                        <span className="meta" style={{ minWidth: 44 }}>{l.unit}</span>
                        <input name="unit_cost" type="number" step="any" defaultValue={Number(l.unit_cost)} aria-label="سعر الوحدة" style={{ width: 110 }} />
                        <button className="btn ghost sm noprint" type="submit">حفظ</button>
                      </form>
                    </td>
                    <td className="n num">{money(Number(l.qty) * Number(l.unit_cost), cur)}</td>
                    <td className="noprint">
                      <form action={deleteEstLine}>
                        <input type="hidden" name="estimate_id" value={e.id} />
                        <input type="hidden" name="line_id" value={l.id} />
                        <button className="btn ghost sm" type="submit" aria-label="حذف">×</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      <h3 className="sec noprint">إضافة بند</h3>
      <form action={addEstLine} className="row noprint">
        <input type="hidden" name="estimate_id" value={e.id} />
        <select name="category" defaultValue="material" aria-label="الفئة" style={{ width: 150 }}>
          {Object.entries(CATEGORY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <input name="description" placeholder="الوصف: فلنجة 4 إنج ANSI 150" aria-label="الوصف" style={{ flex: "1 1 200px", width: "auto" }} required />
        <input name="qty" type="number" step="any" defaultValue={1} aria-label="الكمية" style={{ width: 80 }} />
        <input name="unit" placeholder="الوحدة" aria-label="الوحدة" style={{ width: 80 }} />
        <input name="unit_cost" type="number" step="any" placeholder="سعر الوحدة" aria-label="سعر الوحدة" style={{ width: 120 }} />
        <button className="btn ghost" type="submit">إضافة</button>
      </form>

      <h3 className="sec">من الكلفة للسعر</h3>
      <form action={saveEstimate} className="panel">
        <input type="hidden" name="id" value={e.id} />
        <div className="fields">
          <label className="full">العنوان<input name="title" defaultValue={e.title} /></label>
          <label>العدد<input name="qty" type="number" min="1" defaultValue={e.qty} /></label>
          <label>مصاريف عامة %<input name="overhead_pct" type="number" step="any" defaultValue={Number(e.overhead_pct)} /></label>
          <label>احتياط %<input name="contingency_pct" type="number" step="any" defaultValue={Number(e.contingency_pct)} /></label>
          <label>هامش الربح %<input name="margin_pct" type="number" step="any" defaultValue={Number(e.margin_pct)} /></label>
          <label>
            الحالة
            <select name="status" defaultValue={e.status}>{Object.entries(EST_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
          </label>
          <label>
            العملة
            <select name="currency" defaultValue={e.currency}><option value="IQD">دينار</option><option value="USD">دولار</option></select>
          </label>
          <label className="full">ملاحظات<textarea name="notes" rows={2} defaultValue={e.notes ?? ""} /></label>
        </div>
        <div className="actions"><button className="btn" type="submit">حفظ</button></div>
      </form>
      <div className="tbl" style={{ marginTop: 10 }}>
        <table data-plain>
          <tbody>
            <tr><td>الكلفة المباشرة{e.qty > 1 ? ` × ${e.qty}` : ""}</td><td className="n num">{money(direct, cur)}</td></tr>
            <tr><td>+ مصاريف عامة {num(e.overhead_pct)}% و احتياط {num(e.contingency_pct)}%</td><td className="n num">{money(cost - direct, cur)}</td></tr>
            <tr><td><b>الكلفة الكلية</b></td><td className="n num"><b>{money(cost, cur)}</b></td></tr>
            <tr><td>+ ربح {num(e.margin_pct)}%</td><td className="n num">{money(price - cost, cur)}</td></tr>
            <tr><td><b>سعر البيع</b> (مدوّر لأقرب ألف)</td><td className="n num"><b>{money(price, cur)}</b></td></tr>
            {Number(t?.hours) > 0 && <tr><td className="meta">ساعات العمل الكلية</td><td className="n num meta">{num(Math.round(Number(t?.hours)))} ساعة</td></tr>}
          </tbody>
        </table>
      </div>

      {act && (
        <>
          <h3 className="sec">المقدّر مقابل الفعلي · أمر #{order?.no}</h3>
          <div className="tbl">
            <table data-plain>
              <thead><tr><th>البند</th><th className="n">المقدّر</th><th className="n">الفعلي</th><th className="n">الفرق</th></tr></thead>
              <tbody>
                {(
                  [
                    ["المواد والمستهلكات", Number(t?.material), Number(act.cost_material)],
                    ["الأجور والمكائن", Number(t?.labor), Number(act.cost_labor) + Number(act.cost_machine) + Number(act.cost_machine_hours)],
                    ["الفحص والصبغ والأخرى", Number(t?.other), Number(act.cost_other)],
                    ["المجموع المباشر", direct, Number(act.cost_total)],
                  ] as [string, number, number][]
                ).map(([l, a, b]) => (
                  <tr key={l}>
                    <td>{l}</td>
                    <td className="n num">{money(a, cur)}</td>
                    <td className="n num">{money(b, cur)}</td>
                    <td className={`n num ${b > a ? "neg" : "pos"}`}>{money(b - a, cur)}{a > 0 ? ` (${(((b - a) / a) * 100).toFixed(0)}%)` : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="meta">الفعلي يتحدث تلقائياً من صرف المخزن والقص والأجور وساعات المكائن بأمر العمل. إذا الفرق كبير بنوع معين، عدّل أسعار الكلف.</p>
        </>
      )}

      <p className="meta">
        {PRODUCT_TYPE[e.product_type]}{kg > 0 ? ` · ${num(Math.round(kg))} كغم` : ""}{calc ? ` · من حساب: ${calc.title}` : ""}{e.customer ? ` · ${(e.customer as { name: string }).name}` : ""}
      </p>
      <form action={deleteEstimate} className="noprint" style={{ marginTop: 10 }}>
        <input type="hidden" name="id" value={e.id} />
        <button className="btn ghost danger sm" type="submit">حذف التقدير</button>
      </form>
    </>
  );
}
