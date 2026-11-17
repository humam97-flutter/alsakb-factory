import Link from "next/link";
import { notFound } from "next/navigation";
import { Letterhead, Signatures } from "@/components/letterhead";
import { PrintButton } from "@/components/print-button";
import type { IdPageProps } from "@/components/ui";
import { getBrand } from "@/lib/brand";
import { ITP_STATUS, NAMEPLATE_FIELDS, nameplateDefaults } from "@/lib/itp";
import { num, today } from "@/lib/labels";
import { NCR_SOURCE, NDT_METHODS, WELD_KIND, WELD_STATUS } from "@/lib/quality";
import { qrSvg, siteUrl } from "@/lib/qr";
import { supabase } from "@/lib/supabase/server";
import { orderTrace } from "@/lib/traceability";

const CAT: Record<string, string> = { mtc: "شهادات المواد MTC", ndt: "تقارير الفحص", hydro: "الاختبار المائي", ncr: "عدم المطابقة" };
const HEAD: Record<string, string> = { ellipsoidal: "بيضوي 2:1", torispherical: "طبقي (Torispherical)", hemispherical: "نصف كروي", flat: "مسطح" };

// ملف بيانات المنتج للتسليم: يجمع التصميم والمواد واللحام والفحوصات والاختبار ولوحة الاسم
export default async function DataBookPage({ params }: IdPageProps) {
  const { id } = await params;
  const db = await supabase();
  const [{ data: o }, { data: calc }, { data: itp }, { data: welds }, { data: ndt }, { data: hydro }, { data: ncrs }, { data: wps }, { data: workers }, { data: quals }, { data: files }, trace] = await Promise.all([
    db.from("work_orders").select("id, no, product, client, qty, unit, due_date, nameplate, created_at").eq("id", id).maybeSingle(),
    db.from("calcs").select("kind, title, inputs, results").eq("order_id", id).in("kind", ["vessel", "tank"]).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    db.from("itp_items").select("*").eq("order_id", id).order("seq"),
    db.from("welds").select("*").eq("order_id", id).order("kind").order("code"),
    db.from("ndt_reports").select("*").eq("order_id", id).order("day"),
    db.from("hydro_tests").select("*").eq("order_id", id).order("day"),
    db.from("ncrs").select("*").eq("order_id", id).order("no"),
    db.from("wps").select("id, code, process, base_metal, thickness_range, filler, positions, pqr_no"),
    db.from("workers").select("id, full_name, welder_stamp"),
    db.from("welder_quals").select("worker_id, process, cert_no, expires_on"),
    db.from("order_files").select("id, name, category, ref_id, created_at").eq("order_id", id).neq("category", "general").order("created_at"),
    orderTrace(db, id),
  ]);
  if (!o) notFound();
  const brand = await getBrand();
  const qr = await qrSvg(await siteUrl(`/orders/${o.id}/qa`));
  const saved = o.nameplate as Record<string, string>;
  const plate = Object.keys(saved ?? {}).length ? saved : nameplateDefaults(o, calc as never);
  const ws = welds ?? [];
  const wpsMap = new Map((wps ?? []).map((w) => [w.id, w]));
  const wkMap = new Map((workers ?? []).map((w) => [w.id, w]));
  const weldCode = new Map(ws.map((w) => [w.id, w.code]));
  const usedWps = [...new Set(ws.map((w) => w.wps_id).filter(Boolean))].map((x) => wpsMap.get(x as string)).filter(Boolean);
  const usedWelders = [...new Set(ws.flatMap((w) => [w.welder_id, w.welder2_id]).filter(Boolean))] as string[];
  const stamp = (wid: string | null) => (wid ? wkMap.get(wid)?.welder_stamp ?? wkMap.get(wid)?.full_name ?? "" : "");
  const inp = (calc?.inputs ?? {}) as Record<string, string>;
  const res = (calc?.results ?? {}) as Record<string, unknown>;
  const accepted = ws.filter((w) => w.status === "accepted").length;

  const sections = ["معلومات المنتج ولوحة الاسم", "بيانات التصميم", "تتبع المواد", "إجراءات اللحام واللحامين", "خريطة اللحامات", "الفحوصات اللاإتلافية", "الاختبار المائي", "خطة الفحص ITP", "عدم المطابقة", "فهرس المرفقات"];
  const Empty = ({ t }: { t: string }) => <p className="empty">{t}</p>;
  const order: [string, string | null][] = [
    ["أمر العمل", `#${o.no}`],
    ["المنتج", o.product],
    ["الزبون", o.client],
    ["الكمية", o.qty ? `${num(o.qty)} ${o.unit ?? ""}` : null],
    ["موعد التسليم", o.due_date],
    ["اللحامات المقبولة", `${accepted} من ${ws.length}`],
  ];

  return (
    <div className="paper db">
      <div className="noprint actions" style={{ marginTop: 0, marginBottom: 16, paddingTop: 0, borderTop: 0 }}>
        <PrintButton />
        <Link className="btn ghost" href={`/orders/${id}/qa`}>رجوع للجودة</Link>
      </div>
      <Letterhead brand={brand} title="ملف بيانات المنتج Data Book" info={[["أمر العمل", `#${o.no}`], ["تاريخ الإصدار", today()]]} />

      <h3>1. {sections[0]}</h3>
      <div className="two">
        <div>
          <table><tbody>{order.filter(([, v]) => v).map(([l, v]) => <tr key={l}><th style={{ width: "40%" }}>{l}</th><td>{v}</td></tr>)}</tbody></table>
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 10, fontSize: 11, color: "#444" }}>
            <div style={{ width: 80, height: 80 }} dangerouslySetInnerHTML={{ __html: qr }} />
            امسح الرمز لعرض سجل الجودة الكامل والمرفقات
          </div>
        </div>
        <div className="np">
          <div className="np-title">لوحة الاسم · NAMEPLATE</div>
          <table><tbody>{NAMEPLATE_FIELDS.filter(([k]) => plate[k]).map(([k, l]) => <tr key={k}><th style={{ width: "50%" }}>{l}</th><td className="num"><bdi className="ltr">{plate[k]}</bdi></td></tr>)}</tbody></table>
        </div>
      </div>
      <p style={{ marginBottom: 0, fontWeight: 600 }}>المحتويات</p>
      <ol className="toc">{sections.map((s) => <li key={s}>{s}</li>)}</ol>

      <h3 className="brk">2. {sections[1]}</h3>
      {calc?.kind === "vessel" ? (
        <table>
          <tbody>
            <tr><th>الحساب</th><td>{calc.title} · ASME VIII Div.1</td><th>المادة</th><td className="num">{inp.mat}</td></tr>
            <tr><th>القطر الداخلي</th><td className="num">{inp.d} ملم</td><th>الطول بين خطي اللحام</th><td className="num">{inp.l} ملم</td></tr>
            <tr><th>ضغط التصميم</th><td className="num">{inp.p} bar</td><th>سماحية التآكل</th><td className="num">{inp.ca} ملم</td></tr>
            <tr><th>نوع الرأس</th><td>{HEAD[inp.head] ?? inp.head}</td><th>فحص اللحام الطولي</th><td>{plate.rt}</td></tr>
            <tr><th>سمك الجسم</th><td className="num">{String(res.tShell)} ملم</td><th>سمك الرأس</th><td className="num">{String(res.tHead)} ملم</td></tr>
            <tr><th>MAWP</th><td className="num">{plate.mawp_bar} bar</td><th>ضغط الاختبار المائي</th><td className="num">{plate.test_bar} bar</td></tr>
          </tbody>
        </table>
      ) : calc?.kind === "tank" ? (
        <table>
          <tbody>
            <tr><th>الحساب</th><td>{calc.title} · API 650</td><th>المادة</th><td className="num">{inp.mat}</td></tr>
            <tr><th>القطر</th><td className="num">{inp.d} ملم</td><th>الارتفاع</th><td className="num">{inp.h} ملم</td></tr>
            <tr><th>الكثافة النوعية</th><td className="num">{inp.g}</td><th>سماحية التآكل</th><td className="num">{inp.ca} ملم</td></tr>
            <tr><th>سماكات الأطواق</th><td className="num" colSpan={3}>{((res.courses as number[]) ?? []).join(" / ")} ملم</td></tr>
            <tr><th>سمك الأرضية</th><td className="num">{String(res.tBottom ?? "")} ملم</td><th>السعة الاسمية</th><td className="num">{plate.capacity} لتر</td></tr>
          </tbody>
        </table>
      ) : <Empty t="ما اكو حساب هندسي مرتبط بهذا الأمر." />}

      <h3>3. {sections[2]}</h3>
      {trace.rows.length ? (
        <table>
          <thead><tr><th>القطعة / المادة</th><th>العدد</th><th>الدرجة</th><th>السمك / المقاس</th><th>المصدر</th><th>رقم الصبة</th><th>الشهادة</th></tr></thead>
          <tbody>{trace.rows.map((r) => <tr key={r.key}><td>{r.part}</td><td className="num">{r.qty ? num(r.qty) : ""}</td><td className="num">{r.grade}</td><td className="num"><bdi className="ltr">{r.thickness ? num(r.thickness) : r.size}</bdi></td><td>{r.source}</td><td className="num">{r.heat_no ?? "—"}</td><td className="num">{r.cert_no}</td></tr>)}</tbody>
        </table>
      ) : <Empty t="ما مسجلة مواد بعد." />}

      <h3 className="brk">4. {sections[3]}</h3>
      {usedWps.length ? (
        <table>
          <thead><tr><th>WPS</th><th>الطريقة</th><th>المعدن الأساس</th><th>مدى السمك</th><th>سلك / إلكترود</th><th>الأوضاع</th><th>PQR</th></tr></thead>
          <tbody>{usedWps.map((w) => <tr key={w!.id}><td className="num"><b>{w!.code}</b></td><td>{w!.process}</td><td>{w!.base_metal}</td><td>{w!.thickness_range}</td><td className="num">{w!.filler}</td><td>{w!.positions}</td><td className="num">{w!.pqr_no}</td></tr>)}</tbody>
        </table>
      ) : <Empty t="ما محدد WPS على اللحامات." />}
      {usedWelders.length > 0 && (
        <table style={{ marginTop: 10 }}>
          <thead><tr><th>الرمز</th><th>اللحام</th><th>المؤهلات (الطريقة · الشهادة · الانتهاء)</th></tr></thead>
          <tbody>{usedWelders.map((wid) => <tr key={wid}><td className="num"><b>{wkMap.get(wid)?.welder_stamp}</b></td><td>{wkMap.get(wid)?.full_name}</td><td className="num">{(quals ?? []).filter((q) => q.worker_id === wid).map((q) => `${q.process} · ${q.cert_no ?? ""} · ${q.expires_on ?? ""}`).join(" | ")}</td></tr>)}</tbody>
        </table>
      )}

      <h3>5. {sections[4]}</h3>
      {ws.length ? (
        <table>
          <thead><tr><th>الرمز</th><th>النوع</th><th>الوصف</th><th>السمك / الطول</th><th>WPS</th><th>اللحام</th><th>الفحص</th><th>الحالة</th></tr></thead>
          <tbody>{ws.map((w) => <tr key={w.id}><td className="num"><b>{w.code}</b></td><td>{WELD_KIND[w.kind]}</td><td>{w.description}</td><td className="num">{w.thickness ? num(w.thickness) : ""}{w.length_mm ? ` / ${num(w.length_mm)}` : ""}</td><td className="num">{w.wps_id ? wpsMap.get(w.wps_id)?.code : ""}</td><td className="num">{[stamp(w.welder_id), stamp(w.welder2_id)].filter(Boolean).join(" + ")}</td><td className="num">{(w.ndt as string[]).join("، ")}</td><td>{WELD_STATUS[w.status]?.label}</td></tr>)}</tbody>
        </table>
      ) : <Empty t="ما مسجلة لحامات." />}

      <h3 className="brk">6. {sections[5]}</h3>
      {ndt?.length ? (
        <table>
          <thead><tr><th>الطريقة</th><th>رقم التقرير</th><th>التاريخ</th><th>الجهة · الفاحص</th><th>النسبة</th><th>اللحامات</th><th>النتيجة</th></tr></thead>
          <tbody>{ndt.map((r) => <tr key={r.id}><td>{NDT_METHODS[r.method]}</td><td className="num">{r.report_no}</td><td className="num">{r.day}</td><td>{[r.agency, r.inspector].filter(Boolean).join(" · ")}</td><td className="num">{r.extent}</td><td className="num">{(r.weld_ids as string[]).map((x) => weldCode.get(x)).filter(Boolean).join("، ")}</td><td>{r.result === "accept" ? "مقبول" : "مرفوض"}</td></tr>)}</tbody>
        </table>
      ) : <Empty t="ما مسجلة تقارير فحص." />}

      <h3>7. {sections[6]}</h3>
      {hydro?.length ? (
        <table>
          <thead><tr><th>التاريخ</th><th>ضغط التصميم</th><th>ضغط الاختبار</th><th>المدة</th><th>الوسط · الحرارة</th><th>المانوميتر · المعايرة</th><th>الشاهد</th><th>النتيجة</th></tr></thead>
          <tbody>{hydro.map((h) => <tr key={h.id}><td className="num" style={{ whiteSpace: "nowrap" }}>{h.day}</td><td className="num">{h.design_bar ? `${num(h.design_bar)} bar` : ""}</td><td className="num" style={{ whiteSpace: "nowrap" }}>{num(h.test_bar)} bar</td><td className="num">{h.hold_min} دقيقة</td><td>{h.medium}{h.temp_c != null ? ` · ${h.temp_c}°م` : ""}</td><td className="num">{h.gauge_no}{h.gauge_cal_due ? ` · ${h.gauge_cal_due}` : ""}</td><td>{h.witness}</td><td>{h.result === "pass" ? "ناجح" : "فاشل"}</td></tr>)}</tbody>
        </table>
      ) : <Empty t="ما مسجل اختبار مائي." />}

      <h3 className="brk">8. {sections[7]}</h3>
      {itp?.length ? (
        <table>
          <thead><tr><th>#</th><th>النشاط</th><th>المرجع</th><th>معيار القبول</th><th>المعمل</th><th>الزبون</th><th>TPI</th><th>الحالة · التاريخ · التوقيع</th></tr></thead>
          <tbody>{itp.map((i) => <tr key={i.id}><td className="num">{i.seq}</td><td>{i.activity}</td><td>{i.reference}</td><td>{i.acceptance}</td><td className="num">{i.factory}</td><td className="num">{i.client}</td><td className="num">{i.tpi}</td><td style={{ minWidth: 120 }}>{ITP_STATUS[i.status]?.label}{i.done_on ? ` · ${i.done_on}` : ""}{i.done_by ? ` · ${i.done_by}` : ""}</td></tr>)}</tbody>
        </table>
      ) : <Empty t="ما اكو خطة فحص." />}

      <h3>9. {sections[8]}</h3>
      {ncrs?.length ? (
        <table>
          <thead><tr><th>الرقم</th><th>التاريخ</th><th>المصدر</th><th>المشكلة</th><th>الإجراء</th><th>الحالة</th></tr></thead>
          <tbody>{ncrs.map((r) => <tr key={r.id}><td className="num">NCR-{r.no}</td><td className="num">{r.day}</td><td>{NCR_SOURCE[r.source]}</td><td>{r.description}</td><td>{r.action}</td><td>{r.status === "open" ? "مفتوحة" : `مغلقة ${r.closed_on ?? ""}`}</td></tr>)}</tbody>
        </table>
      ) : <Empty t="ما اكو حالات عدم مطابقة." />}

      <h3>10. {sections[9]}</h3>
      {files?.length ? (
        <table>
          <thead><tr><th>#</th><th>النوع</th><th>الملف</th><th>التاريخ</th></tr></thead>
          <tbody>{files.map((f, i) => <tr key={f.id}><td className="num">{i + 1}</td><td>{CAT[f.category] ?? f.category}</td><td>{f.name}</td><td className="num">{String(f.created_at).slice(0, 10)}</td></tr>)}</tbody>
        </table>
      ) : <Empty t="ما اكو مرفقات." />}

      <Signatures names={["مسؤول الجودة", "مدير الإنتاج", "ممثل الزبون", "جهة التفتيش"]} />
    </div>
  );
}
