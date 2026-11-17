import Link from "next/link";
import { Alert, Pill, type PageProps } from "@/components/ui";
import { can, getMe } from "@/lib/auth";
import { MACHINE_STATUS, money, num, ORDER_STATUS, today } from "@/lib/labels";
import { supabase } from "@/lib/supabase/server";

export default async function Dashboard({ searchParams }: PageProps) {
  const { error } = await searchParams;
  const me = await getMe();
  const db = await supabase();
  const t = today();
  const [{ data: orders }, { data: machines }, { data: materials }, { data: maint }, att, fin] = await Promise.all([
    db.from("work_orders").select("id, no, product, client, status, due_date").not("status", "in", "(delivered,cancelled)"),
    db.from("machines").select("id, code, name, status, next_service"),
    db.from("materials").select("id, name, qty, min_qty, unit, unit_price, currency"),
    db.from("maintenance").select("id").neq("state", "done"),
    can.attendance(me.role) ? db.from("attendance").select("status").eq("day", t) : Promise.resolve({ data: null }),
    can.finance(me.role) ? db.from("work_order_costs").select("price, paid, currency") : Promise.resolve({ data: null }),
  ]);
  const o = orders ?? [];
  const late = o.filter((x) => x.due_date && x.due_date < t && !["done"].includes(x.status));
  const active = o.filter((x) => x.status === "in_progress");
  const down = (machines ?? []).filter((m) => m.status === "broken" || m.status === "maintenance");
  const due = (machines ?? []).filter((m) => m.next_service && m.next_service <= t && m.status === "running");
  const low = (materials ?? []).filter((m) => m.min_qty !== null && Number(m.qty) <= Number(m.min_qty));
  const present = (att.data ?? []).filter((a) => a.status === "present" || a.status === "half").length;
  const debtIqd = (fin.data ?? []).filter((f) => f.currency === "IQD" && f.price != null).reduce((a, f) => a + Math.max(0, Number(f.price) - Number(f.paid)), 0);
  const debtUsd = (fin.data ?? []).filter((f) => f.currency === "USD" && f.price != null).reduce((a, f) => a + Math.max(0, Number(f.price) - Number(f.paid)), 0);

  const kpi = (n: React.ReactNode, label: string, href: string, tone?: string) => (
    <Link className="kpi" href={href}>
      <b className={tone}>{n}</b>
      <span>{label}</span>
    </Link>
  );

  return (
    <>
      <Alert error={error} />
      <div className="kpis">
        {kpi(active.length, "أوامر قيد التنفيذ", "/orders?status=in_progress", active.length ? "tone-warn" : "")}
        {kpi(late.length, "أوامر متأخرة", "/orders", late.length ? "tone-bad" : "")}
        {kpi(down.length, "مكائن عاطلة أو بالصيانة", "/machines", down.length ? "tone-bad" : "")}
        {kpi(low.length, "مواد تحت حد الطلب", "/stock", low.length ? "tone-bad" : "")}
        {kpi(maint?.length ?? 0, "صيانات مفتوحة", "/maintenance", maint?.length ? "tone-warn" : "")}
        {att.data && kpi(present, "عمال حاضرون اليوم", "/workers", present ? "tone-ok" : "")}
        {fin.data && kpi(money(debtIqd), "ديون عند الزبائن", "/orders", debtIqd ? "tone-warn" : "")}
        {fin.data && debtUsd > 0 && kpi(money(debtUsd, "USD"), "ديون بالدولار", "/orders", "tone-warn")}
      </div>

      {late.length > 0 && (
        <>
          <h3 className="sec">أوامر متأخرة</h3>
          <div className="grid">
            {late.map((x) => (
              <Link key={x.id} href={`/orders/${x.id}`} className="card s-bad">
                <div className="row between"><span className="t">#{x.no} · {x.product}</span><Pill map={ORDER_STATUS} value={x.status} /></div>
                <div className="meta">{x.client && <span>{x.client}</span>}<span>التسليم: <span className="num">{x.due_date}</span></span></div>
              </Link>
            ))}
          </div>
        </>
      )}

      {low.length > 0 && (
        <>
          <h3 className="sec">مواد يجب طلبها</h3>
          <div className="tbl">
            <table>
              <thead><tr><th>المادة</th><th className="n">الرصيد</th><th className="n">حد الطلب</th></tr></thead>
              <tbody>
                {low.map((m) => (
                  <tr key={m.id}><td>{m.name}</td><td className="n num neg">{num(m.qty)} {m.unit}</td><td className="n num">{num(m.min_qty)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {(down.length > 0 || due.length > 0) && (
        <>
          <h3 className="sec">مكائن تحتاج انتباه</h3>
          <div className="grid">
            {[...down, ...due].map((m) => (
              <div key={m.id} className={`card s-${MACHINE_STATUS[m.status].tone}`}>
                <div className="row between"><span className="t">{m.code}. {m.name}</span><Pill map={MACHINE_STATUS} value={m.status} /></div>
                {m.next_service && m.next_service <= t && <div className="meta">الصيانة الدورية مستحقة منذ {m.next_service}</div>}
              </div>
            ))}
          </div>
        </>
      )}

      {!late.length && !low.length && !down.length && !due.length && (
        <div className="empty">ماكو شي يحتاج انتباه اليوم.</div>
      )}
    </>
  );
}
