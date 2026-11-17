import { type PageProps } from "@/components/ui";
import { paint, PROCESSES, weld } from "@/lib/engineering";
import { f, N, Out, read, Sel } from "../shared";

// تقدير مواد وساعات اللحام، ولترات الصبغ
export default async function WeldPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const v = read(sp, { len: 20, t: 10, angle: 60, proc: "smaw", op: 35, area: 50, dft: 75, vs: 50, coats: 3, loss: 30 });
  const w = weld(Number(v.len) * 1000, Number(v.t), String(v.proc), Number(v.angle), Math.max(0.05, Number(v.op) / 100));
  const p = paint(Number(v.area), Math.max(1, Number(v.dft)), Math.max(1, Number(v.vs)), Number(v.loss), Number(v.coats));

  return (
    <>
      <div className="bar"><h2>اللحام والصبغ</h2></div>
      <form method="get" className="panel noprint">
        <b>اللحام</b>
        <div className="fields" style={{ marginTop: 8 }}>
          <N name="len" label="طول اللحام (متر)" v={v.len} />
          <N name="t" label="سمك اللوح (ملم)" v={v.t} />
          <N name="angle" label="زاوية الشطف الكلية (°)" v={v.angle} />
          <Sel name="proc" label="الطريقة" v={String(v.proc)} options={Object.fromEntries(Object.entries(PROCESSES).map(([k, x]) => [k, x.label]))} />
          <N name="op" label="نسبة وقت القوس الفعلي (%)" v={v.op} hint="يدوي 25 إلى 35، أوتوماتيك 50 إلى 70" />
        </div>
        <b style={{ display: "block", marginTop: 12 }}>الصبغ</b>
        <div className="fields" style={{ marginTop: 8 }}>
          <N name="area" label="المساحة (م²)" v={v.area} />
          <N name="dft" label="سمك الطبقة الجافة (مايكرون)" v={v.dft} />
          <N name="vs" label="نسبة المواد الصلبة (%)" v={v.vs} hint="من ورقة بيانات الصبغ" />
          <N name="coats" label="عدد الطبقات" v={v.coats} />
          <N name="loss" label="الهدر (%)" v={v.loss} hint="رش 30 إلى 50، فرشاة 10 إلى 20" />
        </div>
        <div className="actions"><button className="btn" type="submit">احسب</button></div>
      </form>
      <h3 className="sec">اللحام</h3>
      <Out
        rows={[
          ["مساحة مقطع اللحام", `${f(w.area, 0)} mm²`, "شطف V مع فتحة جذر 2 ملم وتحديب"],
          ["معدن مترسب لكل متر", `${f((w.area * 7.85) / 1000, 2)} kg/m`],
          ["المعدن المترسب الكلي", `${f(w.deposit)} kg`],
          ["أقطاب أو سلك لازم", `${f(w.consumable)} kg`, `كفاءة ${Math.round(w.p.eff * 100)}%`],
          ["وقت القوس", `${f(w.arcHours)} h`, `معدل ترسيب ${w.p.rate} كغم/ساعة`],
          ["ساعات العمل", `${f(w.hours)} h`, "مع التحضير والتنظيف والتنقل"],
        ]}
      />
      <h3 className="sec">الصبغ</h3>
      <Out
        rows={[
          ["التغطية النظرية", `${f(p.spread, 2)} m²/L`, "المواد الصلبة × 10 ÷ السمك"],
          ["الكمية اللازمة", `${f(p.liters)} L`, `${v.coats} طبقة، مع هدر ${v.loss}%`],
        ]}
      />
    </>
  );
}
