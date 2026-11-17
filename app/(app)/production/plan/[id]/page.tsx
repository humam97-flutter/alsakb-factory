import Link from "next/link";
import { notFound } from "next/navigation";
import { Gantt } from "@/components/gantt";
import { Alert, type IdPageProps } from "@/components/ui";
import { can, getMe } from "@/lib/auth";
import { num, STAGE_STATUS, today } from "@/lib/labels";
import { addDays, centerColor, PRODUCT_TYPE, weightProgress } from "@/lib/planning";
import { supabase } from "@/lib/supabase/server";
import { autoPlan, saveOrderBasis, saveStagePlan, standardRouting } from "../../planning-actions";

// خطة أمر واحد: الوزن والنوع، المراحل بمراكزها وساعاتها وتواريخها
export default async function OrderPlanPage({ params, searchParams }: IdPageProps) {
  const { id } = await params;
  const sp = await searchParams;
  const me = await getMe();
  const edit = can.production(me.role);
  const db = await supabase();
  const [{ data: o }, { data: stages }, { data: centers }, { data: st }] = await Promise.all([
    db.from("work_orders").select("id, no, product, client, start_date, due_date, weight_kg, product_type, status").eq("id", id).maybeSingle(),
    db.from("work_order_stages").select("*").eq("order_id", id).order("position"),
    db.from("work_centers").select("id, name, color").eq("active", true).order("position"),
    db.from("settings").select("off_days").limit(1).maybeSingle(),
  ]);
  if (!o) notFound();
  const off = ((st?.off_days as number[] | null) ?? [5]).map(Number);
  const ss = stages ?? [];
  const color = new Map((centers ?? []).map((c) => [c.id, centerColor(c.color)]));
  const planned = ss.filter((s) => s.plan_start && s.plan_end);
  const end = planned.reduce((m, s) => (s.plan_end > m ? s.plan_end : m), "");
  const start = planned.reduce((m, s) => (!m || s.plan_start < m ? s.plan_start : m), "");
  const prog = weightProgress(ss);
  const hours = ss.reduce((a, s) => a + Number(s.plan_hours ?? 0), 0);
  const t = today();
  const late = !!(o.due_date && end && end > o.due_date);
  const doneKg = o.weight_kg ? (Number(o.weight_kg) * prog) / 100 : null;
  const from = start ? addDays(start < t ? start : t, -2) : addDays(t, -2);
  const span = Math.max(21, Math.min(120, (end ? Math.round((new Date(end).getTime() - new Date(from).getTime()) / 86400000) : 21) + 7));
  const started = ss.some((s) => s.status !== "waiting");

  return (
    <>
      <Alert error={sp.error} ok={sp.ok} />
      <div className="bar">
        <h2>خطة الأمر #{o.no} · {o.product}</h2>
        <div className="row noprint">
          <Link className="btn ghost" href="/production/gantt">المخطط الزمني</Link>
          <Link className="btn ghost" href={`/orders/${id}`}>صفحة الأمر</Link>
        </div>
      </div>
      <div className="kpis">
        <div className="kpi"><span>الإنجاز بالوزن</span><b className="num">{prog}%</b><div className="prog" style={{ marginTop: 6 }}><i style={{ width: `${prog}%` }} /></div></div>
        <div className="kpi"><span>المنجز</span><b className="num">{doneKg != null ? `${num(Math.round(doneKg))} من ${num(Number(o.weight_kg))} كغم` : "—"}</b></div>
        <div className="kpi"><span>ساعات العمل المخططة</span><b className="num">{num(Math.round(hours))}</b></div>
        <div className="kpi"><span>نهاية الخطة · التسليم</span><b className={`num${late ? " neg" : ""}`}>{end || "—"}</b><span className="meta num">{o.due_date ?? ""}</span></div>
      </div>

      {edit && (
        <div className="panel noprint" style={{ marginBottom: 12 }}>
          <form action={saveOrderBasis} className="row" style={{ gap: 8 }}>
            <input type="hidden" name="order_id" value={id} />
            <label className="row" style={{ gap: 4 }}><span className="meta">الوزن (كغم)</span><input name="weight_kg" type="number" step="any" defaultValue={o.weight_kg ?? ""} style={{ width: 110 }} /></label>
            <label className="row" style={{ gap: 4 }}><span className="meta">النوع</span>
              <select name="product_type" defaultValue={o.product_type ?? "other"} style={{ width: 110 }}>{Object.entries(PRODUCT_TYPE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
            </label>
            <label className="row" style={{ gap: 4 }}><span className="meta">تاريخ البدء</span><input name="start_date" type="date" defaultValue={o.start_date ?? ""} style={{ width: 150 }} /></label>
            <button className="btn ghost" type="submit">حفظ</button>
          </form>
          <div className="row" style={{ marginTop: 10, gap: 8 }}>
            <form action={autoPlan}>
              <input type="hidden" name="order_id" value={id} />
              <button className="btn" type="submit">{planned.length ? "إعادة التخطيط تلقائياً" : "خطط تلقائياً"}</button>
            </form>
            {!started && (
              <form action={standardRouting} className="row" style={{ gap: 6 }}>
                <input type="hidden" name="order_id" value={id} />
                <input type="hidden" name="product_type" value={o.product_type ?? "other"} />
                <button className="btn ghost" type="submit">استبدال المراحل بالمسار القياسي ({PRODUCT_TYPE[o.product_type ?? "other"]})</button>
              </form>
            )}
          </div>
          <p className="meta" style={{ marginBottom: 0 }}>
            الساعات تنحسب من التسعير التقديري إذا الأمر جاي من عرض سعر، وإلا من الوزن × ساعات الطن. المراحل تنجدول وحدة ورا الثانية من اليوم (أو تاريخ البدء) وتتجاوز العطلة.
          </p>
        </div>
      )}

      {planned.length > 0 && (
        <Gantt
          from={from}
          days={span}
          today={t}
          off={off}
          rows={ss.filter((s) => s.plan_start && s.plan_end).map((s) => ({
            key: s.id,
            label: s.name,
            sub: <span className="num">{num(Number(s.plan_hours ?? 0))} س · {s.status === "done" ? 100 : s.progress}%</span>,
            due: o.due_date,
            bars: [{ key: s.id, start: s.plan_start, end: s.plan_end, color: color.get(s.work_center_id ?? "") ?? "var(--muted)", label: s.name, progress: s.status === "done" ? 100 : s.progress, done: s.status === "done" }],
          }))}
        />
      )}

      <h3 className="sec">المراحل</h3>
      <div className="tbl">
        <table data-plain>
          <thead><tr><th>#</th><th>المرحلة</th><th>الحالة</th><th>مركز العمل · الساعات · الحصة % · من · إلى</th></tr></thead>
          <tbody>
            {ss.map((s) => (
              <tr key={s.id}>
                <td className="num">{s.position}</td>
                <td>{s.name}{s.status !== "done" && s.plan_end && s.plan_end < t ? <div><span className="pill tone-bad">متأخرة</span></div> : null}</td>
                <td><span className={`pill tone-${STAGE_STATUS[s.status]?.tone}`}>{STAGE_STATUS[s.status]?.label}</span>{s.status === "working" ? <div className="meta num">{s.progress}%</div> : null}</td>
                <td>
                  {edit ? (
                    <form action={saveStagePlan} className="row" style={{ gap: 4 }}>
                      <input type="hidden" name="id" value={s.id} />
                      <input type="hidden" name="order_id" value={id} />
                      <select name="work_center_id" defaultValue={s.work_center_id ?? ""} aria-label="مركز العمل" style={{ width: 150 }}>
                        <option value="">-</option>
                        {(centers ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                      <input name="plan_hours" type="number" step="any" defaultValue={s.plan_hours ?? ""} aria-label="الساعات" placeholder="ساعات" style={{ width: 72 }} />
                      <input name="weight_pct" type="number" step="any" defaultValue={s.weight_pct ?? ""} aria-label="الحصة %" placeholder="%" style={{ width: 60 }} />
                      <input name="plan_start" type="date" defaultValue={s.plan_start ?? ""} aria-label="من" style={{ width: 140 }} />
                      <input name="plan_end" type="date" defaultValue={s.plan_end ?? ""} aria-label="إلى" style={{ width: 140 }} />
                      <button className="btn ghost sm" type="submit">حفظ</button>
                    </form>
                  ) : (
                    <span className="num">{s.plan_start ? `${s.plan_start} ← ${s.plan_end}` : "—"} · {num(Number(s.plan_hours ?? 0))} س</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
