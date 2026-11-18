import { Alert, type PageProps } from "@/components/ui";
import { can, getMe } from "@/lib/auth";
import { addDays, money, num, today } from "@/lib/labels";
import { supabase } from "@/lib/supabase/server";
import { deletePrice, savePrice } from "./actions";

const ITEMS = ["صاج أسود", "صاج مغلون", "صاج ستانلس", "حديد تسليح", "مقاطع (شيلمان وزاوية)", "أنابيب", "سكراب"];

type P = { id: string; day: string; item: string; grade: string | null; thickness: string | null; price_ton: number; currency: string; source: string | null; note: string | null };

// خط سعر لكل مادة (دولار/طن). المحور واحد، والألوان بالترتيب
function PriceChart({ series }: { series: { name: string; pts: { day: string; v: number }[] }[] }) {
  const all = series.flatMap((s) => s.pts);
  if (all.length < 2) return <div className="empty">يحتاج سعرين على الأقل حتى يطلع الرسم.</div>;
  const W = 720, H = 240, pl = 52, pr = 16, pt = 14, pb = 28;
  const days = all.map((p) => +new Date(p.day));
  const x0 = Math.min(...days), x1 = Math.max(...days) || x0 + 1;
  const lo = Math.min(...all.map((p) => p.v)), hi = Math.max(...all.map((p) => p.v));
  const pad = (hi - lo) * 0.15 || hi * 0.05 || 1;
  const y0 = Math.max(0, lo - pad), y1 = hi + pad;
  const X = (d: string) => pl + ((+new Date(d) - x0) / (x1 - x0 || 1)) * (W - pl - pr);
  const Y = (v: number) => pt + (1 - (v - y0) / (y1 - y0)) * (H - pt - pb);
  const ticks = Array.from({ length: 4 }, (_, i) => y0 + ((y1 - y0) * i) / 3);
  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", direction: "ltr" }} role="img" aria-label="أسعار الحديد بالدولار للطن">
        {ticks.map((v) => (
          <g key={v}>
            <line x1={pl} x2={W - pr} y1={Y(v)} y2={Y(v)} stroke="var(--line-2)" />
            <text x={pl - 6} y={Y(v)} textAnchor="end" dominantBaseline="middle" fontSize="11" fill="var(--muted)">{Math.round(v)}</text>
          </g>
        ))}
        {[x0, (x0 + x1) / 2, x1].map((d, i) => (
          <text key={i} x={pl + ((d - x0) / (x1 - x0 || 1)) * (W - pl - pr)} y={H - 8} textAnchor={i === 0 ? "start" : i === 2 ? "end" : "middle"} fontSize="11" fill="var(--muted)">{new Date(d).toISOString().slice(0, 10)}</text>
        ))}
        {series.map((s, i) => (
          <g key={s.name}>
            <polyline fill="none" stroke={`var(--nest-${i % 6})`} strokeWidth="2" strokeLinejoin="round" points={s.pts.map((p) => `${X(p.day)},${Y(p.v)}`).join(" ")} />
            {s.pts.map((p, j) => (
              <circle key={j} cx={X(p.day)} cy={Y(p.v)} r="4" fill={`var(--nest-${i % 6})`} stroke="var(--panel)" strokeWidth="2">
                <title>{`${s.name} · ${p.day}: ${Math.round(p.v)} $/طن`}</title>
              </circle>
            ))}
          </g>
        ))}
      </svg>
      {series.length > 1 && (
        <div className="legend">{series.map((s, i) => <span key={s.name}><i style={{ background: `var(--nest-${i % 6})` }} />{s.name}</span>)}</div>
      )}
    </>
  );
}

export default async function PricesPage({ searchParams }: PageProps) {
  const { error, ok } = await searchParams;
  const me = await getMe();
  const edit = me.role === "manager" || me.role === "accountant" || me.role === "storekeeper";
  const db = await supabase();
  const t = today();
  const [{ data: rows }, { data: st }, { data: plates }] = await Promise.all([
    db.from("steel_prices").select("*").gte("day", addDays(t, -365)).order("day", { ascending: false }).limit(500),
    db.from("settings").select("usd_rate").eq("id", 1).maybeSingle(),
    db.from("plates").select("price_kg, received_on").is("parent_id", null).gt("price_kg", 0).gte("received_on", addDays(t, -90)),
  ]);
  const rate = Number(st?.usd_rate ?? 1500);
  const ps = (rows ?? []) as P[];
  const usd = (p: P) => (p.currency === "USD" ? Number(p.price_ton) : Number(p.price_ton) / rate);
  const items = [...new Set(ps.map((p) => p.item))];
  const series = items.slice(0, 4).map((name) => ({ name, pts: ps.filter((p) => p.item === name).map((p) => ({ day: p.day, v: usd(p) })).reverse() }));
  const black = ps.filter((p) => p.item === "صاج أسود");
  const last = black[0];
  const month = black.find((p) => p.day <= addDays(t, -30));
  const change = last && month ? ((usd(last) - usd(month)) / usd(month)) * 100 : null;
  const ours = plates?.length ? (plates.reduce((a, p) => a + Number(p.price_kg), 0) / plates.length) * 1000 : null; // دينار/طن
  const diff = ours && last ? ((ours / rate - usd(last)) / usd(last)) * 100 : null;

  return (
    <>
      <Alert error={error} ok={ok} />
      <div className="bar"><h2>أسعار الحديد</h2></div>
      <div className="kpis">
        <div className="kpi"><span>الصاج الأسود بالسوق</span><b className="num">{last ? `${num(Math.round(usd(last)))} $` : "—"}</b><span className="meta">{last ? `للطن · ${last.day}${last.source ? ` · ${last.source}` : ""}` : "سجّل أول سعر"}</span></div>
        <div className="kpi"><span>التغيّر خلال شهر</span><b className={`num${change != null && change > 0 ? " neg" : change != null && change < 0 ? " pos" : ""}`}>{change != null ? `${change > 0 ? "+" : ""}${change.toFixed(1)}%` : "—"}</b><span className="meta">{change != null ? (change > 2 ? "السعر صاعد: اشترِ مبكر للأوامر الجاية" : change < -2 ? "السعر نازل: لا تخزّن هواية" : "مستقر") : ""}</span></div>
        <div className="kpi"><span>معدل شرانا (آخر 3 أشهر)</span><b className="num">{ours ? `${num(Math.round(ours / rate))} $` : "—"}</b><span className="meta">{ours ? `${money(Math.round(ours))} للطن${diff != null ? ` · ${diff > 0 ? "أغلى" : "أرخص"} من السوق ${Math.abs(diff).toFixed(1)}%` : ""}` : "من أسعار الألواح المستلمة"}</span></div>
      </div>

      <div className="panel" style={{ marginBottom: 14 }}>
        <div className="panel-h"><b>السعر بالدولار للطن (آخر سنة)</b></div>
        <PriceChart series={series} />
      </div>

      {edit && (
        <form action={savePrice} className="panel" style={{ marginBottom: 14 }}>
          <div className="panel-h"><b>سجّل سعر جديد</b><span className="meta">من عرض مورد، أو سعر السوق، أو البورصة</span></div>
          <div className="fields">
            <label>المادة<input name="item" list="steel-items" defaultValue="صاج أسود" /></label>
            <label>التاريخ<input name="day" type="date" defaultValue={t} /></label>
            <label>النوع<input name="grade" placeholder="A36، ST37..." /></label>
            <label>السمك<input name="thickness" placeholder="مثلاً 3-12 ملم" /></label>
            <label>السعر للطن<input name="price_ton" type="number" step="any" inputMode="decimal" required /></label>
            <label>العملة<select name="currency" defaultValue="USD"><option value="USD">دولار</option><option value="IQD">دينار</option></select></label>
            <label>المصدر<input name="source" placeholder="اسم المورد أو السوق" /></label>
            <label>ملاحظة<input name="note" /></label>
          </div>
          <datalist id="steel-items">{ITEMS.map((x) => <option key={x} value={x} />)}</datalist>
          <div className="actions"><button className="btn" type="submit">حفظ</button></div>
        </form>
      )}

      {ps.length ? (
        <div className="tbl">
          <table data-plain>
            <thead><tr><th>التاريخ</th><th>المادة</th><th>النوع والسمك</th><th className="n">السعر للطن</th><th className="n">بالدولار</th><th>المصدر</th>{edit && <th />}</tr></thead>
            <tbody>
              {ps.slice(0, 60).map((p) => (
                <tr key={p.id}>
                  <td className="num">{p.day}</td>
                  <td>{p.item}</td>
                  <td>{[p.grade, p.thickness].filter(Boolean).join(" · ")}</td>
                  <td className="n num">{money(p.price_ton, p.currency)}</td>
                  <td className="n num">{num(Math.round(usd(p)))} $</td>
                  <td>{p.source}{p.note && <div className="meta">{p.note}</div>}</td>
                  {edit && <td><form action={deletePrice}><input type="hidden" name="id" value={p.id} /><button className="btn danger sm" data-confirm="تحذف السعر؟">حذف</button></form></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty">ماكو أسعار مسجلة. سجّل سعر الصاج كل أسبوع حتى يطلع الاتجاه والمقارنة.</div>
      )}
    </>
  );
}
