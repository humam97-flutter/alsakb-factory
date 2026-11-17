import { Alert, Input, Select, type PageProps } from "@/components/ui";
import { CURRENCIES, EXPENSE_CATEGORIES, money, PAY_METHOD, today } from "@/lib/labels";
import { supabase } from "@/lib/supabase/server";
import { deleteExpense, saveExpense } from "../actions";

export default async function ExpensesPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const month = sp.month ?? today().slice(0, 7);
  const first = `${month}-01`;
  const next = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 1)).toISOString().slice(0, 10);
  const db = await supabase();
  const { data: rows } = await db.from("expenses").select("*").gte("day", first).lt("day", next).order("day", { ascending: false });
  const back = `/accounts/expenses?month=${month}`;
  const byCat = new Map<string, Record<string, number>>();
  for (const r of rows ?? []) {
    const x = byCat.get(r.category) ?? {};
    x[r.currency] = (x[r.currency] ?? 0) + Number(r.amount);
    byCat.set(r.category, x);
  }
  const cats = [...byCat.entries()].sort((a, b) => (b[1].IQD ?? 0) - (a[1].IQD ?? 0));
  const sum = (cur: string) => (rows ?? []).filter((r) => r.currency === cur).reduce((a, r) => a + Number(r.amount), 0);

  return (
    <>
      <Alert error={sp.error} ok={sp.ok} />
      <form className="bar" method="get">
        <h2>المصاريف</h2>
        <input type="month" name="month" defaultValue={month} aria-label="الشهر" style={{ maxWidth: 180 }} />
        <button className="btn ghost sm" type="submit">عرض</button>
      </form>

      <form action={saveExpense} className="panel">
        <input type="hidden" name="back" value={back} />
        <datalist id="expense-cats">{EXPENSE_CATEGORIES.map((c) => <option key={c} value={c} />)}</datalist>
        <div className="fields">
          <Input name="category" label="النوع (اختار أو اكتب)" list="expense-cats" required />
          <Input name="amount" label="المبلغ" type="number" required />
          <Select name="currency" label="العملة" options={CURRENCIES} value="IQD" blank={false} />
          <Select name="method" label="طريقة الدفع" options={PAY_METHOD} value="cash" blank={false} />
          <Input name="day" label="التاريخ" type="date" value={today()} />
          <Input name="note" label="ملاحظة" full />
        </div>
        <div className="actions"><button className="btn" type="submit">تسجيل المصروف</button></div>
      </form>

      <div className="kpis" style={{ marginTop: 12 }}>
        <div className="kpi"><b>{money(sum("IQD"))}</b><span>مصاريف الشهر بالدينار</span></div>
        {sum("USD") > 0 && <div className="kpi"><b>{money(sum("USD"), "USD")}</b><span>بالدولار</span></div>}
      </div>

      {cats.length > 0 && (
        <>
          <h3 className="sec">حسب النوع</h3>
          <div className="tbl">
            <table>
              <thead><tr><th>النوع</th><th className="n">دينار</th><th className="n">دولار</th></tr></thead>
              <tbody>
                {cats.map(([c, v]) => (
                  <tr key={c}><td>{c}</td><td className="n num">{v.IQD ? money(v.IQD) : "—"}</td><td className="n num">{v.USD ? money(v.USD, "USD") : "—"}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <h3 className="sec">كل المصاريف</h3>
      {!rows?.length ? (
        <div className="empty">ما بيه مصاريف بهذا الشهر.</div>
      ) : (
        <div className="tbl">
          <table>
            <thead><tr><th>التاريخ</th><th>النوع</th><th>ملاحظة</th><th>الطريقة</th><th className="n">المبلغ</th><th></th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="num">{r.day}</td>
                  <td>{r.category}</td>
                  <td style={{ whiteSpace: "normal" }}>{r.note}</td>
                  <td>{PAY_METHOD[r.method]}</td>
                  <td className="n num">{money(r.amount, r.currency)}</td>
                  <td>
                    <form action={deleteExpense}>
                      <input type="hidden" name="id" value={r.id} />
                      <input type="hidden" name="back" value={back} />
                      <button className="btn ghost sm" type="submit" aria-label="حذف">×</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
