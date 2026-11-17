import Link from "next/link";
import { Gantt, type GanttRow } from "@/components/gantt";
import { Alert, type PageProps } from "@/components/ui";
import { can, getMe } from "@/lib/auth";
import { num, today } from "@/lib/labels";
import { addDays, centerColor, weightProgress } from "@/lib/planning";
import { supabase } from "@/lib/supabase/server";
import { planAll } from "../planning-actions";

type Stage = { id: string; name: string; status: string; position: number; progress: number; weight_pct: number | null; plan_start: string | null; plan_end: string | null; work_center_id: string | null };

// المخطط الزمني لكل الأوامر المفتوحة
export default async function GanttPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const me = await getMe();
  const edit = can.production(me.role);
  const t = today();
  const from = sp.from && /^\d{4}-\d{2}-\d{2}$/.test(sp.from) ? sp.from : addDays(t, -7);
  const days = 56;
  const db = await supabase();
  const [{ data: orders }, { data: centers }, { data: st }] = await Promise.all([
    db.from("work_orders").select("id, no, product, client, due_date, weight_kg, status, priority, stages:work_order_stages(id, name, status, position, progress, weight_pct, plan_start, plan_end, work_center_id)").in("status", ["new", "in_progress", "on_hold"]).order("due_date", { nullsFirst: false }),
    db.from("work_centers").select("id, name, color").eq("active", true).order("position"),
    db.from("settings").select("off_days").limit(1).maybeSingle(),
  ]);
  const off = ((st?.off_days as number[] | null) ?? [5]).map(Number);
  const color = new Map((centers ?? []).map((c) => [c.id, centerColor(c.color)]));
  const list = (orders ?? []).map((o) => {
    const stages = ((o.stages as Stage[]) ?? []).sort((a, b) => a.position - b.position);
    const planned = stages.filter((s) => s.plan_start && s.plan_end);
    const end = planned.reduce((m, s) => (s.plan_end! > m ? s.plan_end! : m), "");
    const start = planned.reduce((m, s) => (!m || s.plan_start! < m ? s.plan_start! : m), "");
    return { o, stages, planned, start, end, late: !!(o.due_date && end && end > o.due_date), prog: weightProgress(stages) };
  });
  const unplanned = list.filter((x) => !x.planned.length);
  const late = list.filter((x) => x.late);
  const behind = list.filter((x) => x.stages.some((s) => s.status !== "done" && s.plan_end && s.plan_end < t));
  const rows: GanttRow[] = list
    .filter((x) => x.planned.length)
    .sort((a, b) => (a.start < b.start ? -1 : 1))
    .map(({ o, planned, prog, late: isLate }) => ({
      key: o.id,
      href: `/production/plan/${o.id}`,
      label: <>#{o.no} {o.product}</>,
      sub: <>{o.client ? `${o.client} · ` : ""}<span className="num">{prog}%</span>{o.weight_kg ? <> · <span className="num">{num(Math.round(Number(o.weight_kg) / 100) / 10)}</span> طن</> : null}{isLate ? <> · <span style={{ color: "var(--bad)" }}>يتأخر عن التسليم</span></> : null}</>,
      due: o.due_date,
      bars: planned.map((s) => ({ key: s.id, start: s.plan_start!, end: s.plan_end!, color: color.get(s.work_center_id ?? "") ?? "var(--muted)", label: s.name, progress: s.status === "done" ? 100 : s.progress, done: s.status === "done" })),
    }));

  return (
    <>
      <Alert error={sp.error} ok={sp.ok} />
      <div className="bar">
        <h2>المخطط الزمني</h2>
        <div className="row noprint">
          <Link className="btn ghost sm" href={`/production/gantt?from=${addDays(from, -28)}`}>→ الأقرب</Link>
          <Link className="btn ghost sm" href="/production/gantt">اليوم</Link>
          <Link className="btn ghost sm" href={`/production/gantt?from=${addDays(from, 28)}`}>الأبعد ←</Link>
        </div>
      </div>
      <div className="kpis">
        <div className="kpi"><span>أوامر مفتوحة</span><b>{list.length}</b></div>
        <div className="kpi"><span>بدون خطة</span><b>{unplanned.length}</b></div>
        <div className="kpi"><span>متأخرة عن الخطة</span><b className={behind.length ? "neg" : ""}>{behind.length}</b></div>
        <div className="kpi"><span>تتجاوز موعد التسليم</span><b className={late.length ? "neg" : ""}>{late.length}</b></div>
      </div>
      {unplanned.length > 0 && (
        <div className="panel row between" style={{ marginBottom: 12 }}>
          <span>{unplanned.length} أمر بدون خطة: {unplanned.slice(0, 6).map((x) => <Link key={x.o.id} href={`/production/plan/${x.o.id}`} className="num" style={{ marginInlineEnd: 8 }}>#{x.o.no}</Link>)}</span>
          {edit && <form action={planAll}><button className="btn" type="submit">خطط الكل تلقائياً</button></form>}
        </div>
      )}
      <div className="g-legend">
        {(centers ?? []).map((c) => <span key={c.id}><i style={{ ["--c" as string]: centerColor(c.color) }} />{c.name}</span>)}
        <span><i style={{ background: "var(--info)", width: 2 }} />اليوم</span>
        <span><i style={{ background: "none", borderInlineStart: "2px dashed var(--bad)", borderRadius: 0, width: 2 }} />موعد التسليم</span>
      </div>
      {rows.length ? <Gantt from={from} days={days} rows={rows} today={t} off={off} /> : <div className="empty">ما اكو أوامر مخططة. افتح أمر واضغط «خطط تلقائياً»، أو «خطط الكل».</div>}
      <p className="meta">الجزء الغامق من كل شريط هو المنجز. اضغط على الأمر حتى تعدل خطته.</p>
    </>
  );
}
