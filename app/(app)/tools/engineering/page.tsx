import Link from "next/link";
import { Alert, type PageProps } from "@/components/ui";
import { PrintButton } from "@/components/print-button";
import { can, getMe } from "@/lib/auth";
import { ASME_MATERIALS, HEAD_LABEL, JOINT_E, paint, vessel, weld } from "@/lib/engineering";
import { num } from "@/lib/labels";
import { pick, VESSEL_DEF, vesselInput } from "./inputs";
import { bar, f, N, Out, SaveBox, Sel } from "./shared";

// وعاء ضغط أفقي أو عمودي تحت ضغط داخلي، ASME VIII Div.1
export default async function VesselPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const me = await getMe();
  const { inp, mat, m } = vesselInput(sp);
  const ok = inp.P > 0 && inp.D > 0 && inp.L > 0 && inp.S * inp.E > 0.6 * inp.P;
  const r = ok ? vessel(inp) : null;
  const v = { ...VESSEL_DEF, ...sp };
  const proc = sp.proc ?? "smaw";
  const w = r ? weld(r.longLen + r.circLen, r.tShell, proc) : null;
  const pt = r ? paint(r.areaOut, Number(sp.dft ?? 75), Number(sp.vs ?? 50), Number(sp.loss ?? 30), Number(sp.coats ?? 3)) : null;
  const inputs = pick(sp, VESSEL_DEF);

  return (
    <>
      <Alert error={sp.error} ok={sp.ok} />
      <div className="bar">
        <h2>حاسبة وعاء ضغط</h2>
        <span className="meta">ASME VIII Div.1 · ضغط داخلي</span>
        <span style={{ marginInlineStart: "auto" }} className="noprint"><PrintButton /></span>
      </div>

      <form method="get" className="panel noprint">
        <div className="fields">
          <Sel name="mat" label="المادة" v={mat} options={Object.fromEntries(Object.entries(ASME_MATERIALS).map(([k, x]) => [k, `${x.label} · S=${x.S} MPa`]))} />
          <N name="s" label="الإجهاد المسموح S (MPa)" v={sp.s ?? ""} hint={`فارغ = ${m.S} للمادة بحرارة عادية`} />
          <N name="p" label="ضغط التصميم (bar)" v={v.p} />
          <N name="d" label="القطر الداخلي (ملم)" v={v.d} />
          <N name="l" label="طول الجسم بين اللحامين (ملم)" v={v.l} />
          <N name="ca" label="سماحية التآكل (ملم)" v={v.ca} />
          <Sel name="joint" label="فحص لحام الجسم" v={String(v.joint)} options={Object.fromEntries(Object.entries(JOINT_E).map(([k, x]) => [k, x.label]))} />
          <Sel name="head" label="نوع الرأس" v={String(v.head)} options={HEAD_LABEL} />
          <Sel name="hjoint" label="لحام الرأس" v={String(v.hjoint)} options={{ full: "رأس قطعة وحدة / أشعة كاملة · 1.00", spot: "أشعة نقطية · 0.85", none: "بدون أشعة · 0.70" }} />
          <N name="thin" label="ترقق الرأس بالكبس (%)" v={v.thin} />
          <N name="sf" label="الحافة المستقيمة للرأس (ملم)" v={v.sf} />
          <N name="mint" label="أقل سمك تشتغل بيه (ملم)" v={v.mint} />
          <N name="pl" label="طول اللوح (ملم)" v={v.pl} />
          <N name="pw" label="عرض اللوح (ملم)" v={v.pw} />
        </div>
        <div className="actions"><button className="btn" type="submit">احسب</button></div>
      </form>

      {!r ? (
        <div className="alert" role="alert">تأكد من الضغط والقطر والطول، والضغط لازم يكون أقل من S×E÷0.6.</div>
      ) : (
        <>
          <div className="kpis" style={{ marginTop: 14 }}>
            <div className="kpi"><span>سمك الجسم</span><b>{r.tShell} ملم</b></div>
            <div className="kpi"><span>سمك الرأس</span><b>{r.tHead} ملم</b></div>
            <div className="kpi"><span>السعة</span><b>{num(Math.round(r.liters))} لتر</b></div>
            <div className="kpi"><span>الوزن فارغ</span><b>{num(Math.round(r.emptyKg))} كغم</b></div>
            <div className="kpi"><span>الاختبار المائي</span><b>{bar(r.hydro)}</b></div>
          </div>

          <h3 className="sec">الجسم (UG-27)</h3>
          <Out
            rows={[
              ["السمك المطلوب للإجهاد المحيطي", `${f(r.tShellReq, 2)} mm`, "t = P·R ÷ (S·E − 0.6·P)"],
              ["السمك المطلوب للإجهاد الطولي", `${f(r.tLong, 2)} mm`, "t = P·R ÷ (2·S·E + 0.4·P)"],
              ["مع سماحية التآكل", `${f(r.tShellMin, 2)} mm`, `+ ${inp.CA} ملم`],
              ["السمك المختار (لوح تجاري)", `${r.tShell} mm`, r.tShell > Math.ceil(r.tShellMin) ? "أقرب لوح متوفر أو أقل سمك عملي" : ""],
              ["أقصى ضغط مسموح للجسم (MAWP)", bar(r.mawpShell), "بعد التآكل"],
              ["القطر الخارجي", `${f(r.OD, 0)} mm`],
            ]}
          />

          <h3 className="sec">الرأسين: {HEAD_LABEL[inp.head]}</h3>
          <Out
            rows={[
              ["السمك المطلوب", `${f(r.tHeadReq, 2)} mm`, inp.head === "ellipsoidal" ? "UG-32(d): P·D ÷ (2·S·E − 0.2·P)" : inp.head === "torispherical" ? "UG-32(e): 0.885·P·L ÷ (S·E − 0.1·P)" : inp.head === "hemispherical" ? "UG-32(f): P·R ÷ (2·S·E − 0.2·P)" : "UG-34: D·√(C·P ÷ S·E) و C = 0.33"],
              ["مع الترقق والتآكل", `${f(r.tHeadMin, 2)} mm`, `ترقق ${inp.thin}% + ${inp.CA} ملم`],
              ["سمك اللوح المختار", `${r.tHead} mm`, "ما يقل عن سمك الجسم"],
              ["أقصى ضغط مسموح للرأس", bar(r.mawpHead)],
              ...(inp.head !== "flat" ? [["قطر قرص القص (تقريبي)", `Ø ${num(r.blank)} mm`, "قاعدة الورش؛ تأكد من الكابس"] as [string, string, string]] : []),
              ["عمق الرأس", `${f(r.headDepth, 0)} mm`],
              ["وزن القرص الواحد", `${f(r.headBlankKg)} kg`, `والرأس بعد التشكيل ~${f(r.headKg)} كغم`],
            ]}
          />

          <h3 className="sec">الوعاء كامل</h3>
          <Out
            rows={[
              ["أقصى ضغط تشغيل مسموح (MAWP)", bar(r.mawp), "الأقل بين الجسم والرأس"],
              ["ضغط الاختبار المائي", bar(r.hydro), "UG-99(b): 1.3 × MAWP"],
              ["الطول الكلي التقريبي", `${num(Math.round(r.overall))} mm`],
              ["السعة", `${num(Math.round(r.liters))} L`, `${f(r.liters / 1000, 2)} م³`],
              ["وزن الجسم", `${num(Math.round(r.shellKg))} kg`],
              ["الوزن فارغ (جسم ورأسين)", `${num(Math.round(r.emptyKg))} kg`, "بدون فوهات وقواعد"],
              ["الوزن مليان ماي (للاختبار والنقل)", `${num(Math.round(r.waterKg))} kg`],
            ]}
          />

          <h3 className="sec">فرد الجسم للدرفيل</h3>
          <Out
            rows={[
              ["المحيط على القطر الوسطي", `${num(Math.round(r.dev))} mm`, "π × (D + t)"],
              ["عدد الحلقات", `${r.courses}`, `عرض اللوح ${num(inp.plateW)} ملم`],
              ["ألواح كل حلقة", `${r.perCourse}`, `طول القطعة ${num(Math.round(r.pieceL))} ملم`],
              ...r.shellPlates.map((c) => [`الحلقة ${c.course}`, `${c.n} × ${Math.round(c.l)}×${Math.round(c.w)}`, ""] as [string, string, string]),
            ]}
          />

          <h3 className="sec">اللحام والصبغ (تقدير)</h3>
          <form method="get" className="row noprint" style={{ marginBottom: 8 }}>
            {Object.entries(inputs).map(([k, x]) => <input key={k} type="hidden" name={k} value={x} />)}
            <select name="proc" defaultValue={proc} aria-label="طريقة اللحام" style={{ width: 200 }}>
              <option value="smaw">قوس يدوي (SMAW)</option>
              <option value="fcaw">سلك بقلب مساعد (FCAW)</option>
              <option value="gmaw">سلك CO₂ (GMAW)</option>
              <option value="saw">قوس مغمور (SAW)</option>
            </select>
            <input name="dft" type="number" defaultValue={sp.dft ?? 75} aria-label="سمك الطبقة مايكرون" title="سمك الطبقة الجافة مايكرون" style={{ width: 90 }} />
            <input name="coats" type="number" defaultValue={sp.coats ?? 3} aria-label="عدد الطبقات" title="عدد الطبقات" style={{ width: 70 }} />
            <button className="btn ghost" type="submit">حدّث</button>
          </form>
          <Out
            rows={[
              ["طول اللحام الطولي", `${f(r.longLen / 1000, 2)} m`, `${r.longSeams} لحامة`],
              ["طول اللحام المحيطي", `${f(r.circLen / 1000, 2)} m`, `${r.courses - 1} بين الحلقات + 2 للرأسين`],
              ["معدن اللحام المترسب", `${f(w!.deposit)} kg`, `مقطع V بزاوية 60° ≈ ${f(w!.area, 0)} ملم²`],
              ["أقطاب أو سلك لازم", `${f(w!.consumable)} kg`, `${w!.p.label} · كفاءة ${Math.round(w!.p.eff * 100)}%`],
              ["ساعات اللحام", `${f(w!.hours)} h`, `قوس فعلي ${f(w!.arcHours)} ساعة`],
              ["المساحة الخارجية", `${f(r.areaOut, 2)} m²`],
              ["الصبغ", `${f(pt!.liters)} L`, `${sp.coats ?? 3} طبقات × ${sp.dft ?? 75} مايكرون، مواد صلبة 50%، هدر 30%`],
            ]}
          />
          <p className="meta">
            التصميم بحرارة عادية بدون أحمال إضافية (رياح، زلازل، فوهات، قواعد). هذه حسابات للتقدير والتسعير؛ التصميم النهائي يراجعه مهندس معتمد.{" "}
            <Link href="/tools/engineering/weld">حاسبة لحام وصبغ مفصلة</Link>
          </p>
          {can.production(me.role) && (
            <SaveBox kind="vessel" inputs={inputs} title={`وعاء ${HEAD_LABEL[inp.head]} Ø${inp.D}×${inp.L} @ ${inp.P * 10} bar`} parts />
          )}
        </>
      )}
    </>
  );
}
