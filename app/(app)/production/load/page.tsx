import { GroupedBars } from "@/components/charts";
import { num, today } from "@/lib/labels";
import { addDays, centerColor, centerLoad, dayCapacity, isOff, weekStart, type Center } from "@/lib/planning";
import { supabase } from "@/lib/supabase/server";

const WEEKS = 8;

// حمل مراكز العمل بالأسابيع الجاية مقابل طاقتها، والإنتاج المنجز بالطن
export default async function LoadPage() {
  const db = await supabase();
  const t = today();
  const w0 = weekStart(t);
  const past = addDays(w0, -7 * 7);
  const [{ data: centers }, { data: stages }, { data: done }, { data: st }] = await Promise.all([
    db.from("work_centers").select("*").eq("active", true).order("position"),
    db.from("work_order_stages").select("work_center_id, plan_start, plan_end, plan_hours, progress, status, order:work_orders!inner(status)").not("plan_start", "is", null).neq("status", "done").in("order.status", ["new", "in_progress", "on_hold"]),
    db.from("work_order_stages").select("done_at, weight_pct, order:work_orders!inner(weight_kg)").eq("status", "done").gte("done_at", past),
    db.from("settings").select("off_days").limit(1).maybeSingle(),
  ]);
  const off = ((st?.off_days as number[] | null) ?? [5]).map(Number);
  const cs = (centers ?? []) as Center[];
  const load = centerLoad((stages ?? []) as never, off);
  const weeks = Array.from({ length: WEEKS }, (_, i) => addDays(w0, i * 7));
  const workDays = (ws: string) => Array.from({ length: 7 }, (_, i) => addDays(ws, i)).filter((d) => !isOff(d, off) && d >= t).length;
  const cell = (c: Center, ws: string) => {
    let h = 0;
    for (let i = 0; i < 7; i++) {
      const d = addDays(ws, i);
      if (d >= t) h += load.get(c.id)?.get(d) ?? 0;
    }
    const cap = dayCapacity(c) * workDays(ws);
    return { h, cap, pct: cap > 0 ? Math.round((h / cap) * 100) : h > 0 ? 999 : 0 };
  };
  // متأخر: ساعات مراحل خلص وقتها وما خلصت
  const overdue = new Map<string, number>();
  for (const s of stages ?? []) if (s.work_center_id && s.plan_end && s.plan_end < t) overdue.set(s.work_center_id, (overdue.get(s.work_center_id) ?? 0) + Number(s.plan_hours ?? 0) * (1 - Number(s.progress ?? 0) / 100));

  // الإنتاج بالطن: وزن الأمر × حصة المرحلة المنجزة
  const tonsWeek = Array.from({ length: 8 }, (_, i) => addDays(past, i * 7));
  const tons = tonsWeek.map(() => 0);
  let monthKg = 0;
  const m0 = t.slice(0, 7);
  for (const s of done ?? []) {
    const kg = Number((s.order as unknown as { weight_kg: number | null })?.weight_kg ?? 0) * Number(s.weight_pct ?? 0) / 100;
    const d = String(s.done_at).slice(0, 10);
    const i = tonsWeek.findLastIndex((w) => d >= w);
    if (i >= 0) tons[i] += kg / 1000;
    if (d.slice(0, 7) === m0) monthKg += kg;
  }
  const busiest = cs.map((c) => ({ c, ...cell(c, w0) })).sort((a, b) => b.pct - a.pct)[0];

  return (
    <>
      <div className="bar"><h2>حمل مراكز العمل</h2></div>
      <div className="kpis">
        <div className="kpi"><span>الإنتاج هذا الشهر</span><b className="num">{num(Math.round(monthKg / 100) / 10)} طن</b></div>
        <div className="kpi"><span>أكثر مركز محمّل هذا الأسبوع</span><b style={{ fontFamily: "inherit", letterSpacing: 0, fontSize: 19 }}>{busiest ? busiest.c.name : "—"}</b><span className="meta num">{busiest ? `${busiest.pct}%` : ""}</span></div>
        <div className="kpi"><span>ساعات متأخرة عن الخطة</span><b className={`num${overdue.size ? " neg" : ""}`}>{num(Math.round([...overdue.values()].reduce((a, b) => a + b, 0)))}</b></div>
      </div>

      <h3 className="sec">الحمل بالأسابيع (الساعات المخططة ÷ الطاقة)</h3>
      <div className="tbl">
        <table data-plain>
          <thead>
            <tr>
              <th>مركز العمل</th>
              {weeks.map((w, i) => <th key={w} className={i ? "num" : undefined}>{i === 0 ? "هذا الأسبوع" : w.slice(5).replace("-", "/")}</th>)}
              <th>متأخر</th>
            </tr>
          </thead>
          <tbody>
            {cs.map((c) => (
              <tr key={c.id}>
                <td><span aria-hidden="true" style={{ display: "inline-block", width: 10, height: 10, borderRadius: 3, background: centerColor(c.color), marginInlineEnd: 6 }} />{c.name}<div className="meta num">{num(Math.round(dayCapacity(c) * 10) / 10)} س/يوم</div></td>
                {weeks.map((w) => {
                  const x = cell(c, w);
                  const tone = x.pct > 100 ? "bad" : x.pct >= 85 ? "warn" : "ok";
                  return (
                    <td key={w} title={`${num(Math.round(x.h))} من ${num(Math.round(x.cap))} ساعة`} style={{ minWidth: 74 }}>
                      {x.h > 0 ? (
                        <>
                          <span className="num" style={{ fontWeight: x.pct > 100 ? 700 : 500, color: x.pct > 100 ? "var(--bad)" : undefined }}>{x.pct}%{x.pct > 100 ? " ⚠" : ""}</span>
                          <div className="prog" style={{ marginTop: 4 }}><i style={{ width: `${Math.min(100, x.pct)}%`, background: `var(--${tone})` }} /></div>
                        </>
                      ) : <span className="meta">—</span>}
                    </td>
                  );
                })}
                <td className="num">{overdue.get(c.id) ? <span style={{ color: "var(--bad)" }}>{num(Math.round(overdue.get(c.id)!))} س</span> : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="meta">فوق 100% يعني الشغل المخطط أكثر من طاقة المركز: قدّم أو أخّر مراحل من صفحة خطة الأمر، أو زيد العمال أو ساعات الإضافي.</p>

      <h3 className="sec">الإنتاج المنجز بالطن (آخر 8 أسابيع)</h3>
      <div className="panel">
        <GroupedBars labels={tonsWeek.map((w) => w.slice(5).replace("-", "/"))} series={[{ name: "طن", color: "var(--nest-0)", values: tons.map((x) => Math.round(x * 10) / 10) }]} unit="طن" />
      </div>
      <p className="meta">كل مرحلة تنجز تحسب حصتها من وزن الأمر. مثلاً إذا اللحام 35% من شغل خزان 4 طن، إنجازه يحسب 1.4 طن.</p>
    </>
  );
}
