import { Alert, Input, Select, type PageProps } from "@/components/ui";
import { CASH_KIND, CURRENCIES, money, PAY_METHOD, today } from "@/lib/labels";
import { supabase } from "@/lib/supabase/server";
import { deleteCashEntry, saveCashEntry } from "../actions";

export default async function CashPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const cur = sp.currency === "USD" ? "USD" : "IQD";
  const cashOnly = sp.cash === "1";
  const month = sp.month ?? today().slice(0, 7);
  const first = `${month}-01`;
  const next = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 1)).toISOString().slice(0, 10);
  const db = await supabase();
  let before = db.from("cash_ledger").select("amount").eq("currency", cur).lt("day", first);
  let rowsQ = db.from("cash_ledger").select("*").eq("currency", cur).gte("day", first).lt("day", next).order("day").order("created_at");
  const allQ = db.from("cash_ledger").select("amount, currency, method");
  if (cashOnly) {
    before = before.eq("method", "cash");
    rowsQ = rowsQ.eq("method", "cash");
  }
  const [{ data: prev }, { data: rows }, { data: all }] = await Promise.all([before, rowsQ, allQ]);
  const opening = (prev ?? []).reduce((a, r) => a + Number(r.amount), 0);
  const bal = (c: string, m?: string) =>
    (all ?? []).filter((r) => r.currency === c && (!m || r.method === m)).reduce((a, r) => a + Number(r.amount), 0);
  let run = opening;
  const sumIn = (rows ?? []).filter((r) => Number(r.amount) > 0).reduce((a, r) => a + Number(r.amount), 0);
  const sumOut = (rows ?? []).filter((r) => Number(r.amount) < 0).reduce((a, r) => a - Number(r.amount), 0);
  const q = (o: Record<string, string>) => "?" + new URLSearchParams({ month, currency: cur, ...(cashOnly ? { cash: "1" } : {}), ...o }).toString();

  return (
    <>
      <Alert error={sp.error} ok={sp.ok} />
      <form className="bar" method="get">
        <h2>الصندوق</h2>
        <input type="month" name="month" defaultValue={month} aria-label="الشهر" style={{ maxWidth: 180 }} />
        <select name="currency" defaultValue={cur} aria-label="العملة"><option value="IQD">دينار</option><option value="USD">دولار</option></select>
        <label className="row" style={{ fontSize: 13 }}>
          <input type="checkbox" name="cash" value="1" defaultChecked={cashOnly} style={{ width: "auto" }} /> النقد بس (بدون حوالات وصكوك)
        </label>
        <button className="btn ghost sm" type="submit">عرض</button>
      </form>

      <div className="kpis">
        <div className="kpi"><b>{money(bal("IQD", "cash"))}</b><span>النقد بالصندوق (دينار)</span></div>
        <div className="kpi"><b>{money(bal("USD", "cash"), "USD")}</b><span>النقد بالصندوق (دولار)</span></div>
        <div className="kpi"><b>{money(bal("IQD"))}</b><span>كل الأموال (دينار)</span></div>
        <div className="kpi"><b>{money(bal("USD"), "USD")}</b><span>كل الأموال (دولار)</span></div>
      </div>
      <p className="meta">الصندوق يتحسب وحده من المقبوضات، تسديد الموردين، السلف والرواتب، والمصاريف. هنا تضيف الرصيد الافتتاحي والإيداع والسحب والتصريف.</p>

      <h3 className="sec">حركة الشهر ({cur === "USD" ? "دولار" : "دينار"})</h3>
      <div className="tbl">
        <table>
          <thead><tr><th>التاريخ</th><th>البيان</th><th>الطريقة</th><th className="n">داخل</th><th className="n">طالع</th><th className="n">الرصيد</th><th></th></tr></thead>
          <tbody>
            <tr><td></td><td><b>الرصيد من قبل</b></td><td></td><td></td><td></td><td className="n num"><b>{money(opening, cur)}</b></td><td></td></tr>
            {(rows ?? []).map((r) => {
              run += Number(r.amount);
              return (
                <tr key={r.source + r.id}>
                  <td className="num">{r.day}</td>
                  <td style={{ whiteSpace: "normal" }}>{r.description}</td>
                  <td>{PAY_METHOD[r.method]}</td>
                  <td className="n num pos">{Number(r.amount) > 0 ? money(r.amount, cur) : ""}</td>
                  <td className="n num neg">{Number(r.amount) < 0 ? money(-Number(r.amount), cur) : ""}</td>
                  <td className="n num">{money(run, cur)}</td>
                  <td>
                    {r.source === "entry" && (
                      <form action={deleteCashEntry}>
                        <input type="hidden" name="id" value={r.id} />
                        <button className="btn ghost sm" type="submit" aria-label="حذف">×</button>
                      </form>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr><td colSpan={3}><b>مجموع الشهر</b></td><td className="n num pos">{money(sumIn, cur)}</td><td className="n num neg">{money(sumOut, cur)}</td><td className="n num"><b>{money(run, cur)}</b></td><td /></tr>
          </tfoot>
        </table>
      </div>
      <p className="meta"><a href={q({ currency: cur === "USD" ? "IQD" : "USD" })}>عرض {cur === "USD" ? "الدينار" : "الدولار"}</a></p>

      <h3 className="sec">حركة يدوية</h3>
      <form action={saveCashEntry} className="panel">
        <div className="fields">
          <Select name="kind" label="النوع" options={CASH_KIND} value="deposit" blank={false} />
          <Input name="amount" label="المبلغ" type="number" required />
          <Select name="currency" label="العملة" options={CURRENCIES} value="IQD" blank={false} />
          <Input name="got" label="للتصريف بس: شكد استلمت بالعملة الثانية" type="number" />
          <Input name="day" label="التاريخ" type="date" value={today()} />
          <Input name="note" label="ملاحظة" full />
        </div>
        <div className="actions"><button className="btn" type="submit">تسجيل</button></div>
      </form>
    </>
  );
}
