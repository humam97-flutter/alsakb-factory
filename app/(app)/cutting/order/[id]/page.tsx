import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert, type IdPageProps } from "@/components/ui";
import { NestSvg, YieldBar } from "@/components/nest-svg";
import { can, getMe } from "@/lib/auth";
import { proposeForOrder } from "@/lib/cutting";
import { money, num } from "@/lib/labels";
import { supabase } from "@/lib/supabase/server";
import { approveProposal } from "../../actions";

// اقتراح مخطط القص لأمر عمل: يحسب كل مرة من القطع الباقية والألواح المتوفرة
export default async function ProposalPage({ params, searchParams }: IdPageProps) {
  const { id } = await params;
  const sp = await searchParams;
  const me = await getMe();
  const db = await supabase();
  const { data: o } = await db.from("work_orders").select("id, no, product").eq("id", id).maybeSingle();
  if (!o) notFound();
  const { layouts, unplaced, remaining, settings: s, drafts, parts } = await proposeForOrder(id);
  const real = layouts.filter((l) => !l.virtual);
  const buy = layouts.filter((l) => l.virtual);
  const sum = (k: "plate_kg" | "parts_kg" | "remnant_kg" | "scrap_kg", ls = real) => ls.reduce((a, l) => a + l[k], 0);
  const loss = real.reduce((a, l) => a + l.scrap_kg * (Number(l.plate.price_kg) - s.scrapPrice), 0);
  const y = sum("plate_kg") ? (sum("parts_kg") / sum("plate_kg")) * 100 : 0;
  // شراء: نجمع الألواح المقترحة حسب القياس
  const buyList = new Map<string, { label: string; n: number; kg: number }>();
  for (const l of buy) {
    const k = `${l.plate.grade} · سمك ${l.plate.thickness} ملم · ${l.plate.length_mm}×${l.plate.width_mm}`;
    const e = buyList.get(k) ?? { label: k, n: 0, kg: 0 };
    e.n++;
    e.kg += l.plate_kg;
    buyList.set(k, e);
  }

  return (
    <>
      <Alert error={sp.error} ok={sp.ok} />
      <div className="bar">
        <h2>مخطط قص مقترح · أمر #{o.no} {o.product}</h2>
      </div>
      <div className="actions noprint" style={{ marginTop: 0, marginBottom: 14 }}>
        <Link className="btn ghost" href={`/orders/${o.id}#cutting`}>رجوع لقطع الأمر</Link>
        {can.production(me.role) && real.length > 0 && (
          <form action={approveProposal}>
            <input type="hidden" name="order_id" value={o.id} />
            <button className="btn" type="submit">اعتماد المخطط وحجز الألواح</button>
          </form>
        )}
      </div>

      {!parts.length ? (
        <div className="empty">ما بيه قطع قص مسجلة لهذا الأمر. أضفها من صفحة الأمر.</div>
      ) : !remaining.length ? (
        <div className="empty">كل قطع هذا الأمر انقصت. <Link href={`/cutting/plans?order=${o.id}`}>شوف المخططات المنفذة</Link></div>
      ) : (
        <>
          {drafts > 0 && <div className="alert" style={{ background: "var(--warn-bg)", color: "var(--warn)", borderColor: "transparent" }}>هذا الأمر عنده {drafts} مخطط معتمد ينتظر القص. الاعتماد مرة ثانية يبدّلها بهذا الاقتراح.</div>}
          <div className="kpis">
            <div className="kpi"><span>ألواح من المخزن</span><b>{real.length}</b></div>
            <div className="kpi"><span>نسبة الاستغلال</span><b className={sum("scrap_kg") / (sum("plate_kg") || 1) * 100 > s.alertPct ? "neg" : ""}>{y.toFixed(1)}%</b></div>
            <div className="kpi"><span>الهدر المتوقع</span><b>{num(Math.round(sum("scrap_kg")))} كغم</b></div>
            <div className="kpi"><span>خسارة الهدر المتوقعة</span><b>{money(loss)}</b></div>
            <div className="kpi"><span>بقايا ترجع للمخزن</span><b>{num(Math.round(sum("remnant_kg")))} كغم</b></div>
          </div>

          {buyList.size > 0 && (
            <div className="panel" style={{ marginBottom: 14, borderColor: "var(--warn)" }}>
              <b>الألواح المتوفرة ما تكفي. تحتاج تشتري:</b>
              <ul style={{ margin: "6px 0 0" }}>
                {[...buyList.values()].map((b) => (
                  <li key={b.label}><span className="num">{b.n}</span> لوح {b.label} <span className="meta">(~{num(Math.round(b.kg))} كغم)</span></li>
                ))}
              </ul>
              <p className="meta" style={{ marginBottom: 0 }}>
                القياسات من إعدادات القص. بعد ما توصل سجلها بـ«الألواح» وارجع اقترح من جديد. <Link href="/purchases/requests">طلب شراء</Link>
              </p>
            </div>
          )}
          {unplaced.length > 0 && (
            <div className="alert" role="alert">
              قطع أكبر من كل الألواح والقياسات القياسية: {unplaced.map((u) => `${u.part.name} (${u.qty})`).join("، ")}. تحتاج لحام وصلات أو لوح أكبر.
            </div>
          )}

          {layouts.map((l, i) => (
            <div className="nest-card" key={l.plate.id}>
              <div className="nest-head">
                <h3>
                  {i + 1}. {l.virtual ? "لوح جديد للشراء" : `لوح #${l.plate.serial}`}
                  {l.plate.parent_id && <span className="pill tone-ok" style={{ marginInlineStart: 8 }}>بقية</span>}
                </h3>
                <span className="meta">{l.plate.grade} · سمك {Number(l.plate.thickness)} ملم · <bdi className="num ltr">{Number(l.plate.length_mm)}×{Number(l.plate.width_mm)}</bdi>{l.plate.location ? ` · ${l.plate.location}` : ""}</span>
                <span style={{ marginInlineStart: "auto" }} className="num">{(l.yield * 100).toFixed(1)}%</span>
              </div>
              <NestSvg L={Number(l.plate.length_mm)} W={Number(l.plate.width_mm)} placed={l.placed} remnants={l.remnants} edge={s.edge} />
              <div className="nest-stats">
                <span>القطع <b>{l.placed.length}</b></span>
                <span>اللوح <b>{num(l.plate_kg.toFixed(1))}</b> كغم</span>
                <span>القطع <b>{num(l.parts_kg.toFixed(1))}</b> كغم</span>
                <span>البقايا <b>{num(l.remnant_kg.toFixed(1))}</b> كغم</span>
                <span>الهدر <b>{num(l.scrap_kg.toFixed(1))}</b> كغم</span>
                {!l.virtual && <span>الخسارة <b>{money(l.scrap_kg * (Number(l.plate.price_kg) - s.scrapPrice))}</b></span>}
              </div>
              <div style={{ marginTop: 8 }}><YieldBar parts={l.parts_kg} remnant={l.remnant_kg} scrap={l.scrap_kg} /></div>
            </div>
          ))}
          <p className="meta">
            الترتيب: كل مرة نختار اللوح (أو البقية) اللي يعطي أعلى استغلال، والقطع الكبيرة أولاً مع التدوير. عرض القص {s.kerf} ملم، الحافة {s.edge} ملم، وأصغر بقية تنحفظ {s.minRemnant} ملم.
            الدوائر تنحسب بمربعها على اللوح، ووزنها الحقيقي بالحساب.
          </p>
        </>
      )}
    </>
  );
}
