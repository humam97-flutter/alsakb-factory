import Link from "next/link";
import { GroupedBars, StackBar } from "@/components/charts";
import { Icon } from "@/components/icons";
import { Alert, Pill, type PageProps } from "@/components/ui";
import { can, getMe } from "@/lib/auth";
import { addDays, MACHINE_STATUS, money, num, ORDER_STATUS, today } from "@/lib/labels";
import { supabase } from "@/lib/supabase/server";

const MONTHS = ["كانون2", "شباط", "آذار", "نيسان", "أيار", "حزيران", "تموز", "آب", "أيلول", "تشرين1", "تشرين2", "كانون1"];
const none = Promise.resolve({ data: null });

export default async function Dashboard({ searchParams }: PageProps) {
  const { error } = await searchParams;
  const me = await getMe();
  const fin = can.finance(me.role);
  const db = await supabase();
  const t = today();
  const sixAgo = new Date(Date.UTC(Number(t.slice(0, 4)), Number(t.slice(5, 7)) - 6, 1)).toISOString().slice(0, 10);
  const [{ data: orders }, { data: machines }, { data: materials }, { data: maint }, att, cust, docs, reqs, sup, plans, pnl, settings] = await Promise.all([
    db.from("work_orders").select("id, no, product, client, status, due_date").not("status", "in", "(delivered,cancelled)"),
    db.from("machines").select("id, code, name, status, next_service"),
    db.from("materials").select("id, name, qty, min_qty, unit"),
    db.from("maintenance").select("id").neq("state", "done"),
    can.attendance(me.role) ? db.from("attendance").select("status").eq("day", t) : none,
    fin ? db.from("customer_balances").select("balance, currency") : none,
    can.docs(me.role)
      ? db.from("documents").select("status, due_date, expires_on").neq("status", "archived").or(`status.eq.pending,expires_on.lte.${addDays(t, 30)}`)
      : none,
    fin ? db.from("purchase_requests").select("id").eq("status", "pending") : none,
    fin ? db.from("supplier_balances").select("balance, currency") : none,
    db.from("maintenance_plans").select("id").eq("active", true).lte("next_due", t),
    fin ? db.from("monthly_pnl").select("month, currency, revenue, profit").gte("month", sixAgo) : none,
    fin ? db.from("settings").select("usd_rate").eq("id", 1).maybeSingle() : Promise.resolve({ data: null }),
  ]);

  const o = orders ?? [];
  const late = o.filter((x) => x.due_date && x.due_date < t && x.status !== "done");
  const soon = o.filter((x) => x.due_date && x.due_date >= t && x.due_date <= addDays(t, 7) && x.status !== "done").sort((a, b) => a.due_date!.localeCompare(b.due_date!));
  const ms = machines ?? [];
  const down = ms.filter((m) => m.status === "broken" || m.status === "maintenance");
  const low = (materials ?? []).filter((m) => m.min_qty !== null && Number(m.qty) <= Number(m.min_qty));
  const present = (att.data ?? []).filter((a) => a.status === "present" || a.status === "half").length;
  const sum = (rows: { balance: unknown; currency: string }[] | null, cur: string) => (rows ?? []).filter((x) => x.currency === cur).reduce((a, x) => a + Math.max(0, Number(x.balance)), 0);
  const debtIqd = sum(cust.data, "IQD"), debtUsd = sum(cust.data, "USD"), oweIqd = sum(sup.data, "IQD");
  const docsPending = (docs.data ?? []).filter((d) => d.status === "pending").length;
  const docsExpiring = (docs.data ?? []).filter((d) => d.expires_on && d.expires_on <= addDays(t, 30)).length;

  // آخر 6 أشهر: المبيعات والكلف بالدينار
  const rate = Number((settings.data as { usd_rate?: number } | null)?.usd_rate ?? 1500);
  const months: string[] = [];
  for (let i = 5; i >= 0; i--) months.push(new Date(Date.UTC(Number(t.slice(0, 4)), Number(t.slice(5, 7)) - 1 - i, 1)).toISOString().slice(0, 10));
  const p = (pnl.data ?? []) as { month: string; currency: string; revenue: number; profit: number }[];
  const iqd = (r: { currency: string }, v: number) => Number(v) * (r.currency === "USD" ? rate : 1);
  const rev = months.map((m) => p.filter((r) => r.month === m).reduce((a, r) => a + iqd(r, r.revenue), 0));
  const cost = months.map((m) => p.filter((r) => r.month === m).reduce((a, r) => a + iqd(r, r.revenue - r.profit), 0));
  const profitNow = rev[5] - cost[5];

  const hour = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: "Asia/Baghdad" }).format(new Date()));
  const greet = hour < 12 ? "صباح الخير" : "مساء الخير";
  const dateTxt = new Intl.DateTimeFormat("ar-IQ", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Baghdad" }).format(new Date());

  const kpi = (icon: string, n: React.ReactNode, label: string, href: string, tone = "") => (
    <Link className="kpi" href={href}>
      <span className={`kpi-ic ${tone}`}><Icon name={icon} size={18} /></span>
      <span>{label}</span>
      <b className={tone}>{n}</b>
    </Link>
  );
  const count = (s: string) => o.filter((x) => x.status === s).length;

  return (
    <>
      <Alert error={error} />
      <div className="hello">
        <h2>{greet}، {me.full_name.split(" ")[0]}</h2>
        <span className="meta">{dateTxt}</span>
      </div>

      <div className="kpis">
        {kpi("orders", count("in_progress"), "أوامر قيد التنفيذ", "/orders?status=in_progress", count("in_progress") ? "tone-info" : "")}
        {kpi("clock", late.length, "أوامر متأخرة", "/orders", late.length ? "tone-bad" : "tone-ok")}
        {kpi("machine", `${ms.length - down.length}/${ms.length}`, "مكائن شغالة", "/machines", down.length ? "tone-warn" : "tone-ok")}
        {kpi("stock", low.length, "مواد تحت حد الطلب", "/stock", low.length ? "tone-bad" : "tone-ok")}
        {att.data && kpi("workers", present, "عمال حاضرون اليوم", "/workers", "tone-info")}
        {fin && kpi("sales", money(rev[5]), "مبيعات هذا الشهر", "/accounts/report", "tone-info")}
        {fin && kpi("wallet", money(profitNow), "ربح هذا الشهر", "/accounts/report", profitNow < 0 ? "tone-bad" : "tone-ok")}
        {cust.data && kpi("money", money(debtIqd), "ديون عند الزبائن", "/sales/customers?debt=1", debtIqd ? "tone-warn" : "")}
      </div>

      <div className="dash">
        {fin && (
          <section className="panel w8">
            <div className="panel-h"><b>المبيعات والكلف · آخر 6 أشهر</b><Link href="/accounts/report">التقرير الكامل</Link></div>
            <GroupedBars
              labels={months.map((m) => MONTHS[Number(m.slice(5, 7)) - 1])}
              series={[
                { name: "المبيعات", color: "var(--primary)", values: rev },
                { name: "الكلف", color: "var(--accent)", values: cost },
              ]}
            />
          </section>
        )}
        <section className={`panel ${fin ? "w4" : "w6"}`}>
          <div className="panel-h"><b>أوامر العمل المفتوحة</b><Link href="/orders">الكل</Link></div>
          <div className="kpi" style={{ boxShadow: "none", border: 0, padding: 0, marginBottom: 12 }}>
            <span>المجموع</span><b>{o.length}</b>
          </div>
          <StackBar
            parts={[
              { label: "جديد", value: count("new"), color: "var(--primary)" },
              { label: "قيد التنفيذ", value: count("in_progress"), color: "var(--accent)" },
              { label: "متوقف", value: count("on_hold"), color: "var(--bad)" },
              { label: "مكتمل", value: count("done"), color: "var(--ok)" },
            ]}
          />
          <div className="panel-h" style={{ marginTop: 22 }}><b>المكائن</b><Link href="/machines">الكل</Link></div>
          <StackBar
            parts={[
              { label: "تعمل", value: ms.filter((m) => m.status === "running").length, color: "var(--ok)" },
              { label: "متوقفة", value: ms.filter((m) => m.status === "idle").length, color: "var(--muted)" },
              { label: "صيانة", value: ms.filter((m) => m.status === "maintenance").length, color: "var(--accent)" },
              { label: "عاطلة", value: ms.filter((m) => m.status === "broken").length, color: "var(--bad)" },
            ]}
          />
        </section>

        <section className="panel w6">
          <div className="panel-h"><b>التسليمات القادمة والمتأخرة</b><Link href="/orders">أوامر العمل</Link></div>
          {!late.length && !soon.length ? (
            <div className="meta">ماكو تسليمات خلال الأسبوع الجاي.</div>
          ) : (
            <ul className="list">
              {[...late, ...soon].slice(0, 8).map((x) => (
                <li key={x.id}>
                  <Link href={`/orders/${x.id}`}>#{x.no} · {x.product}{x.client ? ` · ${x.client}` : ""}</Link>
                  <span className={`num ${x.due_date! < t ? "tone-bad" : "meta"}`} style={{ fontSize: 12.5 }}>{x.due_date}</span>
                  <Pill map={ORDER_STATUS} value={x.status} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel w6">
          <div className="panel-h"><b>يحتاج انتباه</b><Link href="/alerts">كل التنبيهات</Link></div>
          <ul className="list">
            {down.map((m) => (
              <li key={m.id}><Link href={`/machines/${m.id}`}>{m.code}. {m.name}</Link><Pill map={MACHINE_STATUS} value={m.status} /></li>
            ))}
            {low.slice(0, 6).map((m) => (
              <li key={m.id}><Link href="/stock">{m.name}</Link><span className="num neg" style={{ fontSize: 13 }}>{num(m.qty)} {m.unit}</span><span className="pill tone-bad">تحت الحد</span></li>
            ))}
            {(maint?.length ?? 0) > 0 && <li><Link href="/maintenance">أعطال مفتوحة</Link><span className="pill tone-warn">{maint!.length}</span></li>}
            {(plans.data?.length ?? 0) > 0 && <li><Link href="/maintenance">صيانة دورية حان موعدها</Link><span className="pill tone-bad">{plans.data!.length}</span></li>}
            {docsPending > 0 && <li><Link href="/documents?status=pending">كتب بانتظار إجراء</Link><span className="pill tone-warn">{docsPending}</span></li>}
            {docsExpiring > 0 && <li><Link href="/documents">مستندات تنتهي خلال شهر</Link><span className="pill tone-bad">{docsExpiring}</span></li>}
            {(reqs.data?.length ?? 0) > 0 && <li><Link href="/purchases/requests">طلبات شراء تنتظر موافقتك</Link><span className="pill tone-warn">{reqs.data!.length}</span></li>}
            {debtUsd > 0 && <li><Link href="/sales/customers?debt=1">ديون الزبائن بالدولار</Link><span className="num">{money(debtUsd, "USD")}</span></li>}
            {oweIqd > 0 && <li><Link href="/purchases/suppliers">علينا للموردين</Link><span className="num">{money(oweIqd)}</span></li>}
          </ul>
          {!down.length && !low.length && !maint?.length && !plans.data?.length && !docsPending && !docsExpiring && !reqs.data?.length && (
            <div className="meta">كلشي تمام، ماكو شي يحتاج انتباه.</div>
          )}
        </section>
      </div>
    </>
  );
}
