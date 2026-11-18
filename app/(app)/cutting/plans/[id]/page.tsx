import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert, type IdPageProps } from "@/components/ui";
import { PrintButton } from "@/components/print-button";
import { NestSvg, YieldBar } from "@/components/nest-svg";
import { can, getMe } from "@/lib/auth";
import { getCutSettings } from "@/lib/cutting";
import { money, num } from "@/lib/labels";
import { partKeys } from "@/lib/dxf";
import type { Placed, Rect } from "@/lib/nesting";
import { supabase } from "@/lib/supabase/server";
import { cancelPlan, finishCut } from "../../actions";

export default async function PlanPage({ params, searchParams }: IdPageProps) {
  const { id } = await params;
  const sp = await searchParams;
  const me = await getMe();
  const db = await supabase();
  const s = await getCutSettings();
  const { data: c } = await db
    .from("cut_plans")
    .select("*, order:work_orders(id, no, product, client), plate:plates(*)")
    .eq("id", id)
    .maybeSingle();
  if (!c) notFound();
  const o = c.order as { id: string; no: number; product: string; client: string | null };
  const p = c.plate as { serial: number; grade: string; thickness: number; length_mm: number; width_mm: number; heat_no: string | null; cert_no: string | null; location: string | null };
  const placed = c.layout as Placed[];
  const rems = c.remnants as Rect[];
  const draft = c.status === "draft";
  const edit = can.production(me.role);
  const y = Number(c.plate_kg) ? (Number(c.parts_kg) / Number(c.plate_kg)) * 100 : 0;
  // جدول القطع: الاسم، القياس، العدد
  const keys = partKeys(placed);
  const parts = new Map<string, { key: string; name: string; size: string; n: number }>();
  for (const x of placed) {
    const size = x.shape === "rect" ? `${Math.round(Math.max(x.w, x.h))}×${Math.round(Math.min(x.w, x.h))}` : x.inner ? `Ø${x.d} / Ø${x.inner}` : `Ø${x.d}`;
    const k = `${x.part_id}`;
    const e = parts.get(k) ?? { key: keys.get(x.part_id) ?? "", name: x.name, size, n: 0 };
    e.n++;
    parts.set(k, e);
  }

  return (
    <>
      <Alert error={sp.error} ok={sp.ok} />
      <div className="bar">
        <h2>مخطط قص · لوح #{p.serial}</h2>
        {draft ? <span className="pill tone-warn">ينتظر القص</span> : <span className="pill tone-ok">منفذ {c.done_at ? new Date(c.done_at).toLocaleDateString("en-CA") : ""}</span>}
      </div>
      <div className="actions noprint" style={{ marginTop: 0, marginBottom: 14 }}>
        <Link className="btn ghost" href={`/orders/${o.id}`}>أمر العمل #{o.no}</Link>
        <Link className="btn ghost" href={`/cutting/plans?order=${o.id}`}>كل مخططات الأمر</Link>
        <a className="btn ghost" href={`/cutting/plans/${c.id}/dxf`} download>تنزيل DXF للـ CNC</a>
        <a className="btn ghost" href={`/cutting/plans/${c.id}/dxf?remnants=1`} download>DXF مع البقايا</a>
        <PrintButton />
      </div>

      <div className="nest-card">
        <div className="nest-head">
          <h3>{p.grade} · سمك {Number(p.thickness)} ملم · <bdi className="num ltr">{Number(p.length_mm)}×{Number(p.width_mm)}</bdi></h3>
          <span className="meta num">{[p.heat_no && `Heat ${p.heat_no}`, p.cert_no && `MTC ${p.cert_no}`, p.location].filter(Boolean).join(" · ")}</span>
        </div>
        <NestSvg L={Number(p.length_mm)} W={Number(p.width_mm)} placed={placed} remnants={rems} edge={s.edge} />
        <div className="nest-stats">
          <span>وزن اللوح <b>{num(c.plate_kg)}</b> كغم</span>
          <span>القطع <b>{num(c.parts_kg)}</b> كغم</span>
          <span>البقايا <b>{num(c.remnant_kg)}</b> كغم</span>
          <span>الهدر <b>{num(c.scrap_kg)}</b> كغم</span>
          <span>الاستغلال <b>{y.toFixed(1)}%</b></span>
          <span>كلفة المادة على الأمر <b>{money(c.material_cost)}</b></span>
          <span>خسارة الهدر <b>{money(c.loss_value)}</b></span>
        </div>
        <div style={{ marginTop: 8 }}><YieldBar parts={Number(c.parts_kg)} remnant={Number(c.remnant_kg)} scrap={Number(c.scrap_kg)} /></div>
      </div>

      <div className="tbl">
        <table data-plain>
          <thead><tr><th>الرمز</th><th>القطعة</th><th className="n">القياس (ملم)</th><th className="n">العدد على هذا اللوح</th></tr></thead>
          <tbody>
            {[...parts.values()].map((x, i) => (
              <tr key={i}><td className="num">{x.key}</td><td>{x.name}</td><td className="n num"><bdi className="ltr">{x.size}</bdi></td><td className="n num">{x.n}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="meta">عرض خط القص {s.kerf} ملم، وحافة اللوح {s.edge} ملم محسوبة. القطع اللي عليها (مدوّرة) بالتلميح تنقص بالعرض.</p>

      {draft && edit && (
        <div className="panel noprint" style={{ marginTop: 14 }}>
          <form action={finishCut}>
            <input type="hidden" name="id" value={c.id} />
            <b>بعد ما يخلص القص:</b>
            {rems.length ? (
              <div className="checks" style={{ margin: "8px 0" }}>
                {rems.map((r, i) => (
                  <label key={i}><input type="checkbox" name={`rem_${i}`} defaultChecked /> احفظ البقية {Math.round(Math.max(r.w, r.h))}×{Math.round(Math.min(r.w, r.h))} ملم كلوح بالمخزن</label>
                ))}
              </div>
            ) : (
              <p className="meta">ما بيه بقية بالحجم المسموح ({s.minRemnant} ملم)، الباقي كله هدر.</p>
            )}
            <div className="row">
              <button className="btn" type="submit">تم القص</button>
              <span className="meta">اللوح ينصرف، البقايا المأشرة ترجع ألواح بنفس رقم الصب، والهدر ينسجل على الأمر وينحسب بكلفته.</span>
            </div>
          </form>
          <form action={cancelPlan} style={{ marginTop: 10 }}>
            <input type="hidden" name="id" value={c.id} />
            <button className="btn ghost danger" type="submit" data-confirm="تلغي المخطط ويرجع اللوح متوفر؟">إلغاء المخطط</button>
          </form>
        </div>
      )}
    </>
  );
}
