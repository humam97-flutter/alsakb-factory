import Link from "next/link";
import { PrintButton } from "@/components/print-button";
import { type PageProps } from "@/components/ui";
import { money, num, today } from "@/lib/labels";
import { supabase } from "@/lib/supabase/server";
import { Bars } from "./bars";

type Pnl = { month: string; currency: string; revenue: number; materials: number; wages: number; expenses: number; maintenance: number; services: number; profit: number };
const KEYS: [keyof Pnl, string][] = [
  ["revenue", "المبيعات (الفواتير)"],
  ["materials", "مواد مصروفة على الأوامر"],
  ["wages", "أجور العمال"],
  ["expenses", "المصاريف العامة"],
  ["maintenance", "الصيانة"],
  ["services", "خدمات ومصاريف بفواتير الشراء"],
];

export default async function ReportPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const month = sp.month ?? today().slice(0, 7);
  const first = `${month}-01`;
  const next = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 1)).toISOString().slice(0, 10);
  const yearAgo = new Date(Date.UTC(Number(month.slice(0, 4)) - 1, Number(month.slice(5, 7)), 1)).toISOString().slice(0, 10);
  const db = await supabase();
  const [{ data: pnl }, { data: settings }, { data: invoices }, { data: stages }, { data: orders }] = await Promise.all([
    db.from("monthly_pnl").select("*").gte("month", yearAgo).lt("month", next),
    db.from("settings").select("usd_rate").eq("id", 1).maybeSingle(),
    db.from("invoices").select("id, currency, customer:customers(id, name)").eq("cancelled", false).gte("day", yearAgo).lt("day", next),
    db.from("work_order_stages").select("machine:machines(id, code, name)").eq("status", "done").gte("done_at", first).lt("done_at", next),
    db.from("work_orders").select("id, status, created_at").gte("created_at", first).lt("created_at", next),
  ]);
  const rate = Number(settings?.usd_rate ?? 1500);
  const rows = (pnl ?? []) as Pnl[];
  const toIqd = (r: Pnl, k: keyof Pnl) => Number(r[k]) * (r.currency === "USD" ? rate : 1);
  const thisMonth = rows.filter((r) => r.month === first);
  const cell = (cur: string, k: keyof Pnl) => thisMonth.filter((r) => r.currency === cur).reduce((a, r) => a + Number(r[k]), 0);
  const all = (k: keyof Pnl) => thisMonth.reduce((a, r) => a + toIqd(r, k), 0);
  const hasUsd = thisMonth.some((r) => r.currency === "USD");

  // آخر 12 شهر: الربح بالدينار
  const months: string[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1 - i, 1));
    months.push(d.toISOString().slice(0, 10));
  }
  const series = months.map((m) => ({ x: m.slice(0, 7), y: rows.filter((r) => r.month === m).reduce((a, r) => a + toIqd(r, "profit"), 0) }));

  // أكثر الزبائن مبيعاً (آخر 12 شهر)
  const ids = (invoices ?? []).map((i) => i.id);
  const { data: tot } = ids.length ? await db.from("invoice_totals").select("invoice_id, total").in("invoice_id", ids) : { data: [] };
  const t = new Map((tot ?? []).map((x) => [x.invoice_id, Number(x.total)]));
  const byCust = new Map<string, { name: string; v: number }>();
  for (const i of invoices ?? []) {
    const c = i.customer as unknown as { id: string; name: string };
    const v = (t.get(i.id) ?? 0) * (i.currency === "USD" ? rate : 1);
    byCust.set(c.id, { name: c.name, v: (byCust.get(c.id)?.v ?? 0) + v });
  }
  const topCust = [...byCust.entries()].sort((a, b) => b[1].v - a[1].v).slice(0, 8);

  // أكثر المكائن شغلاً هذا الشهر (مراحل منجزة)
  const byMachine = new Map<string, { name: string; n: number }>();
  for (const s of stages ?? []) {
    const m = s.machine as unknown as { id: string; code: string; name: string } | null;
    if (!m) continue;
    byMachine.set(m.id, { name: `${m.code}. ${m.name}`, n: (byMachine.get(m.id)?.n ?? 0) + 1 });
  }
  const topMachines = [...byMachine.values()].sort((a, b) => b.n - a.n).slice(0, 8);
  const maxM = Math.max(1, ...topMachines.map((m) => m.n));

  return (
    <>
      <form className="bar" method="get">
        <h2>التقرير الشهري</h2>
        <input type="month" name="month" defaultValue={month} aria-label="الشهر" style={{ maxWidth: 180 }} />
        <button className="btn ghost sm" type="submit">عرض</button>
        <PrintButton />
      </form>

      <div className="kpis">
        <div className="kpi"><b>{money(all("revenue"))}</b><span>مبيعات الشهر</span></div>
        <div className="kpi"><b>{money(all("revenue") - all("profit"))}</b><span>كلف الشهر</span></div>
        <div className="kpi"><b className={all("profit") < 0 ? "tone-bad" : "tone-ok"}>{money(all("profit"))}</b><span>صافي الربح</span></div>
        <div className="kpi"><b>{orders?.length ?? 0}</b><span>أوامر عمل جديدة</span></div>
      </div>

      <h3 className="sec">الأرباح والخسائر</h3>
      <div className="tbl">
        <table>
          <thead>
            <tr><th>البند</th><th className="n">دينار</th>{hasUsd && <th className="n">دولار</th>}{hasUsd && <th className="n">المجموع بالدينار</th>}</tr>
          </thead>
          <tbody>
            {KEYS.map(([k, l], i) => (
              <tr key={k}>
                <td>{i === 0 ? <b>{l}</b> : `− ${l}`}</td>
                <td className="n num">{money(cell("IQD", k))}</td>
                {hasUsd && <td className="n num">{money(cell("USD", k), "USD")}</td>}
                {hasUsd && <td className="n num">{money(all(k))}</td>}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td><b>صافي الربح</b></td>
              <td className={`n num ${cell("IQD", "profit") < 0 ? "neg" : "pos"}`}><b>{money(cell("IQD", "profit"))}</b></td>
              {hasUsd && <td className={`n num ${cell("USD", "profit") < 0 ? "neg" : "pos"}`}><b>{money(cell("USD", "profit"), "USD")}</b></td>}
              {hasUsd && <td className={`n num ${all("profit") < 0 ? "neg" : "pos"}`}><b>{money(all("profit"))}</b></td>}
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="meta">
        المبيعات من الفواتير بتاريخها. المواد بسعرها وقت الصرف. الأجور من كشف الرواتب (المستحق + المكافآت − الخصومات).
        {hasUsd && ` الدولار محسوب بسعر ${num(rate)} من الإعدادات.`}
      </p>

      <h3 className="sec">صافي الربح آخر 12 شهر (دينار)</h3>
      <div className="panel"><Bars data={series} label="صافي الربح الشهري بالدينار" /></div>

      <div className="grid" style={{ marginTop: 14 }}>
        <div className="panel">
          <b>أكثر الزبائن مبيعاً (آخر 12 شهر)</b>
          {!topCust.length ? (
            <p className="meta">ما بيه فواتير بعد.</p>
          ) : (
            <table style={{ marginTop: 6 }}>
              <tbody>
                {topCust.map(([id, c]) => (
                  <tr key={id}><td><Link href={`/sales/customers/${id}`}>{c.name}</Link></td><td className="n num">{money(c.v)}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="panel">
          <b>أكثر المكائن شغلاً هذا الشهر (مراحل منجزة)</b>
          {!topMachines.length ? (
            <p className="meta">ما بيه مراحل منجزة مربوطة بمكائن هذا الشهر.</p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: "8px 0 0" }}>
              {topMachines.map((m) => (
                <li key={m.name} style={{ marginBottom: 6 }}>
                  <div className="row between" style={{ fontSize: 13 }}><span>{m.name}</span><span className="num">{m.n}</span></div>
                  <div style={{ height: 6, background: "var(--chip)", borderRadius: 3 }}>
                    <div style={{ width: `${(m.n / maxM) * 100}%`, height: 6, background: "var(--info)", borderRadius: 3 }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
