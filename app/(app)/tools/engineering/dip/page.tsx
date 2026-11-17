import { type PageProps } from "@/components/ui";
import { PrintButton } from "@/components/print-button";
import { dipChart, HEAD_LABEL, type HeadType } from "@/lib/engineering";
import { num } from "@/lib/labels";
import { read, N, Sel } from "../shared";

// جدول المعايرة: كم لتر بالخزان الأفقي حسب ارتفاع السائل (للمسطرة أو العصا)
export default async function DipPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const v = read(sp, { d: 2000, l: 6000, head: "ellipsoidal", step: 50 });
  const head = (Object.keys(HEAD_LABEL).includes(String(v.head)) ? v.head : "ellipsoidal") as HeadType;
  const step = Math.max(5, Number(v.step));
  const ok = Number(v.d) > 0 && Number(v.l) >= 0 && Number(v.d) / step <= 400;
  const r = ok ? dipChart(Number(v.d), Number(v.l), head, step) : null;

  return (
    <>
      <div className="bar">
        <h2>جدول عمق خزان أفقي</h2>
        <span style={{ marginInlineStart: "auto" }} className="noprint"><PrintButton /></span>
      </div>
      <form method="get" className="panel noprint">
        <div className="fields">
          <N name="d" label="القطر الداخلي (ملم)" v={v.d} />
          <N name="l" label="طول الجسم بدون الرأسين (ملم)" v={v.l} />
          <Sel name="head" label="نوع الرأسين" v={head} options={HEAD_LABEL} />
          <N name="step" label="كل كم ملم سطر" v={step} />
        </div>
        <div className="actions"><button className="btn" type="submit">اطلع الجدول</button></div>
      </form>
      {!r ? (
        <div className="alert" role="alert">تأكد من القطر، والخطوة لازم تطلع أقل من 400 سطر.</div>
      ) : (
        <>
          <div className="kpis" style={{ marginTop: 14 }}>
            <div className="kpi"><span>السعة الكاملة</span><b>{num(Math.round(r.full))} لتر</b></div>
            <div className="kpi"><span>القطر × الطول</span><b><bdi className="ltr">{num(v.d)}×{num(v.l)}</bdi></b></div>
          </div>
          <div className="tbl dip">
            <table data-plain>
              <thead><tr><th className="n">الارتفاع (ملم)</th><th className="n">لتر</th><th className="n">%</th></tr></thead>
              <tbody>
                {r.rows.map((x) => (
                  <tr key={x.h}><td className="n num">{num(x.h)}</td><td className="n num">{num(Math.round(x.liters))}</td><td className="n num">{x.pct.toFixed(1)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="meta">الرأس البيضاوي والنصف كروي محسوبين بالضبط، والتوريسفيريكال تقريبي. القياس من أسفل الخزان من الداخل.</p>
        </>
      )}
    </>
  );
}
