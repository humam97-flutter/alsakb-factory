import { Alert, Input, Pill, Select, type PageProps } from "@/components/ui";
import { can, requireRole } from "@/lib/auth";
import { CURRENCIES, money, num, PAYMENT, today } from "@/lib/labels";
import { supabase } from "@/lib/supabase/server";
import { deletePayment, savePayment } from "../workers/actions";

export default async function PayrollPage({ searchParams }: PageProps) {
  await requireRole(can.finance);
  const sp = await searchParams;
  const month = sp.month ?? today().slice(0, 7);
  const first = `${month}-01`;
  const next = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 1)).toISOString().slice(0, 10);
  const db = await supabase();
  const [{ data: rows }, { data: workers }, { data: payments }] = await Promise.all([
    db.from("monthly_payroll").select("*").eq("month", first).order("full_name"),
    db.from("workers").select("id, full_name").eq("active", true).order("full_name"),
    db.from("worker_payments").select("*, worker:workers(full_name)").gte("day", first).lt("day", next).order("day", { ascending: false }),
  ]);
  const sum = (k: string) => (rows ?? []).reduce((a, r) => a + Number(r[k] ?? 0), 0);

  return (
    <>
      <Alert error={sp.error} />
      <form className="bar" method="get">
        <h2>الرواتب</h2>
        <input type="month" name="month" defaultValue={month} aria-label="الشهر" style={{ maxWidth: 180 }} />
        <button className="btn ghost sm" type="submit">عرض</button>
      </form>
      {!rows?.length ? (
        <div className="empty">لا يوجد حضور أو دفعات لهذا الشهر. سجّل الحضور يومياً من صفحة العمال.</div>
      ) : (
        <div className="tbl">
          <table>
            <thead>
              <tr>
                <th>العامل</th><th className="n">اليومية</th><th className="n">الأيام</th><th className="n">إضافي (ساعة)</th>
                <th className="n">المستحق</th><th className="n">مكافآت</th><th className="n">خصومات</th><th className="n">سلف</th>
                <th className="n">مدفوع</th><th className="n">الباقي له</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.worker_id}>
                  <td>{r.full_name}</td>
                  <td className="n num">{money(r.daily_wage, r.currency)}</td>
                  <td className="n num">{num(r.days)}</td>
                  <td className="n num">{num(r.overtime_hours)}</td>
                  <td className="n num">{money(r.earned, r.currency)}</td>
                  <td className="n num">{money(r.bonus, r.currency)}</td>
                  <td className="n num">{money(r.deduction, r.currency)}</td>
                  <td className="n num">{money(r.advance, r.currency)}</td>
                  <td className="n num">{money(r.paid, r.currency)}</td>
                  <td className={`n num ${Number(r.balance) < 0 ? "neg" : ""}`}><b>{money(r.balance, r.currency)}</b></td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>المجموع</td><td></td><td className="n num">{num(sum("days"))}</td><td className="n num">{num(sum("overtime_hours"))}</td>
                <td className="n num">{money(sum("earned"))}</td><td className="n num">{money(sum("bonus"))}</td><td className="n num">{money(sum("deduction"))}</td>
                <td className="n num">{money(sum("advance"))}</td><td className="n num">{money(sum("paid"))}</td><td className="n num">{money(sum("balance"))}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      <p className="meta">
        المستحق = الأيام × اليومية (نصف يوم = 0.5). الباقي = المستحق + المكافآت − الخصومات − السلف − المدفوع. الساعات الإضافية تظهر للعلم؛ ادفعها كمكافأة. المجموع يفترض عملة واحدة.
      </p>

      <h3 className="sec">تسجيل سلفة أو دفعة</h3>
      <form action={savePayment} className="panel">
        <input type="hidden" name="month" value={month} />
        <div className="fields">
          <Select name="worker_id" label="العامل" options={Object.fromEntries((workers ?? []).map((w) => [w.id, w.full_name]))} />
          <Select name="kind" label="النوع" options={Object.fromEntries(Object.entries(PAYMENT).map(([k, v]) => [k, v.label]))} value="advance" blank={false} />
          <Input name="amount" label="المبلغ" type="number" required />
          <Select name="currency" label="العملة" options={CURRENCIES} value="IQD" blank={false} />
          <Input name="day" label="التاريخ" type="date" value={today()} />
          <Input name="note" label="ملاحظة" />
        </div>
        <div className="actions"><button className="btn" type="submit">تسجيل</button></div>
      </form>

      <h3 className="sec">دفعات الشهر</h3>
      {payments?.length ? (
        <div className="tbl">
          <table>
            <thead><tr><th>التاريخ</th><th>العامل</th><th>النوع</th><th className="n">المبلغ</th><th>ملاحظة</th><th></th></tr></thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id}>
                  <td className="num">{p.day}</td>
                  <td>{(p.worker as { full_name: string }).full_name}</td>
                  <td><Pill map={PAYMENT} value={p.kind} /></td>
                  <td className="n num">{money(p.amount, p.currency)}</td>
                  <td>{p.note}</td>
                  <td>
                    <form action={deletePayment}>
                      <input type="hidden" name="id" value={p.id} />
                      <input type="hidden" name="month" value={month} />
                      <button className="btn ghost sm" type="submit" aria-label="حذف الدفعة">×</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty">لا توجد دفعات مسجلة لهذا الشهر.</div>
      )}
    </>
  );
}
