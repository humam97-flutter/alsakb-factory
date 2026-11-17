import { Alert, type PageProps } from "@/components/ui";
import { PrintButton } from "@/components/print-button";
import { can, getMe } from "@/lib/auth";
import { API650_MATERIALS, api650, paint } from "@/lib/engineering";
import { num } from "@/lib/labels";
import { pick, TANK_DEF, tankInput } from "../inputs";
import { f, N, Out, SaveBox, Sel } from "../shared";

// خزان عمودي جوي لخزن النفط والمشتقات، API 650 بطريقة القدم الواحدة
export default async function TankPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const me = await getMe();
  const { inp, mat } = tankInput(sp);
  const ok = inp.D > 0 && inp.H > 0 && inp.plateW > 0 && inp.D <= 61000;
  const r = ok ? api650(inp) : null;
  const v = { ...TANK_DEF, ...sp };
  const inputs = pick(sp, TANK_DEF);
  const pt = r ? paint(r.areaOut, 75, 50, 30, 3) : null;

  return (
    <>
      <Alert error={sp.error} ok={sp.ok} />
      <div className="bar">
        <h2>خزان عمودي للنفط والمشتقات</h2>
        <span className="meta">API 650 · طريقة القدم الواحدة (1-Foot)</span>
        <span style={{ marginInlineStart: "auto" }} className="noprint"><PrintButton /></span>
      </div>
      <form method="get" className="panel noprint">
        <div className="fields">
          <Sel name="mat" label="مادة الجدار" v={mat} options={Object.fromEntries(Object.entries(API650_MATERIALS).map(([k, x]) => [k, `${x.label} · Sd ${x.Sd} / St ${x.St}`]))} />
          <N name="d" label="القطر الداخلي (ملم)" v={v.d} />
          <N name="h" label="ارتفاع الجدار (ملم)" v={v.h} />
          <N name="hl" label="أعلى منسوب للسائل (ملم)" v={v.hl} />
          <N name="g" label="الكثافة النوعية للسائل" v={v.g} hint="بانزين 0.74، كاز 0.80، كازويل 0.85، نفط خام 0.85 إلى 0.9، ماي 1" />
          <N name="ca" label="سماحية تآكل الجدار (ملم)" v={v.ca} />
          <N name="bca" label="سماحية تآكل القاع (ملم)" v={v.bca} />
          <N name="pw" label="عرض اللوح = ارتفاع الحلقة (ملم)" v={v.pw} />
          <N name="pl" label="طول اللوح (ملم)" v={v.pl} />
        </div>
        <div className="actions"><button className="btn" type="submit">احسب</button></div>
      </form>

      {!r ? (
        <div className="alert" role="alert">تأكد من القطر والارتفاع. طريقة القدم الواحدة لحد قطر 61 متر.</div>
      ) : (
        <>
          <div className="kpis" style={{ marginTop: 14 }}>
            <div className="kpi"><span>السعة الاسمية</span><b>{num(Math.round(r.nominal / 1000))} م³</b></div>
            <div className="kpi"><span>السعة التشغيلية</span><b>{num(Math.round(r.working / 1000))} م³</b></div>
            <div className="kpi"><span>عدد الحلقات</span><b>{r.courses.length}</b></div>
            <div className="kpi"><span>وزن الحديد التقريبي</span><b>{num(Math.round(r.totalKg / 100) / 10)} طن</b></div>
          </div>

          <h3 className="sec">سمك الحلقات (5.6.3)</h3>
          <div className="tbl">
            <table data-plain>
              <thead><tr><th className="n">الحلقة</th><th className="n">العرض</th><th className="n">H (م)</th><th className="n">td تصميم</th><th className="n">tt اختبار</th><th className="n">الأدنى</th><th className="n">المطلوب</th><th className="n">اللوح</th><th className="n">الوزن كغم</th></tr></thead>
              <tbody>
                {r.courses.map((c) => (
                  <tr key={c.course}>
                    <td className="n num">{c.course}</td>
                    <td className="n num">{num(c.w)}</td>
                    <td className="n num">{c.Hc}</td>
                    <td className="n num">{c.td}</td>
                    <td className="n num">{c.tt}</td>
                    <td className="n num">{r.tMin}</td>
                    <td className="n num">{c.req}</td>
                    <td className="n num"><b>{c.t}</b></td>
                    <td className="n num">{num(Math.round((Math.PI * (inp.D + c.t) * c.t * c.w * 7.85) / 1e6))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="meta">td = 4.9·D·(H − 0.3)·G ÷ Sd + CA و tt = 4.9·D·(H − 0.3) ÷ St، الحلقة 1 بالأسفل. أقل سمك لقطر {f(inp.D / 1000)} م هو {r.tMin} ملم.</p>

          <h3 className="sec">القاع والسقف والتفريد</h3>
          <Out
            rows={[
              ["محيط الجدار", `${num(Math.round(r.circ))} mm`],
              ["ألواح كل حلقة", `${r.perCourse}`, `طول القطعة ${num(Math.round(r.pieceL))} ملم`],
              ["وزن الجدار", `${num(Math.round(r.shellKg))} kg`],
              ["سمك القاع", `${r.tBottom} mm`, "6 ملم أدنى + التآكل (5.4.1)"],
              ["قطر القاع", `${num(Math.round(r.bottomD))} mm`, "مع بروز 50 ملم"],
              ["وزن القاع", `${num(Math.round(r.bottomKg))} kg`],
              ["وزن سقف مخروطي خفيف", `${num(Math.round(r.roofKg))} kg`, `${r.tRoof} ملم، بدون الهيكل الحامل`],
              ["المساحة الخارجية (جدار وسقف)", `${f(r.areaOut, 1)} m²`, `صبغ ~${f(pt!.liters)} لتر لـ 3 طبقات`],
              ["الوزن مليان ماي", `${num(Math.round(r.waterKg / 1000))} t`, "للاختبار المائي والأساس"],
            ]}
          />
          <p className="meta">بدون حلقة الرياح والسلالم والفوهات وحسابات الزلازل. للتقدير والتسعير؛ التصميم النهائي يراجعه مهندس معتمد.</p>
          {can.production(me.role) && <SaveBox kind="tank" inputs={inputs} title={`خزان API 650 Ø${inp.D / 1000}×${inp.H / 1000} م`} parts />}
        </>
      )}
    </>
  );
}
