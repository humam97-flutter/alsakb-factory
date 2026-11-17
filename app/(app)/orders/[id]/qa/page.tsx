import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert, type IdPageProps } from "@/components/ui";
import { Upload } from "@/components/upload";
import { can, getMe } from "@/lib/auth";
import { fileSize, num, today } from "@/lib/labels";
import { NCR_SOURCE, NDT_METHODS, WELD_KIND, WELD_STATUS } from "@/lib/quality";
import { supabase } from "@/lib/supabase/server";
import { nameplateDefaults } from "@/lib/itp";
import { orderTrace } from "@/lib/traceability";
import { ItpSection, NameplateSection, TraceSection } from "./sections";
import { addQualityFiles, deleteHydro, deleteNcr, deleteNdt, deleteWeld, saveHydro, saveNcr, saveNdt, saveWeld, updateWeld } from "../../../quality/actions";

// ملف جودة الأمر: خريطة اللحامات، الفحوصات، الاختبار المائي، وعدم المطابقة
export default async function OrderQaPage({ params, searchParams }: IdPageProps) {
  const { id } = await params;
  const sp = await searchParams;
  const me = await getMe();
  const edit = can.production(me.role);
  const db = await supabase();
  const [{ data: o }, { data: welds }, { data: ndt }, { data: hydro }, { data: ncrs }, { data: wps }, { data: workers }, { data: files }, { data: calc }, { data: itp }, { data: calcAny }, trace] = await Promise.all([
    db.from("work_orders").select("id, no, product, client, nameplate, created_at").eq("id", id).maybeSingle(),
    db.from("welds").select("*").eq("order_id", id).order("kind").order("code"),
    db.from("ndt_reports").select("*").eq("order_id", id).order("day"),
    db.from("hydro_tests").select("*").eq("order_id", id).order("day"),
    db.from("ncrs").select("*").eq("order_id", id).order("no"),
    db.from("wps").select("id, code, process").eq("active", true).order("code"),
    db.from("workers").select("id, full_name, welder_stamp").eq("active", true).order("full_name"),
    db.from("order_files").select("*").eq("order_id", id).neq("category", "general").order("created_at"),
    db.from("calcs").select("results").eq("order_id", id).eq("kind", "vessel").limit(1).maybeSingle(),
    db.from("itp_items").select("*").eq("order_id", id).order("seq"),
    db.from("calcs").select("kind, inputs, results").eq("order_id", id).in("kind", ["vessel", "tank"]).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    orderTrace(db, id),
  ]);
  if (!o) notFound();
  const ws = welds ?? [];
  const wName = new Map((workers ?? []).map((w) => [w.id, w.welder_stamp ? `${w.welder_stamp} · ${w.full_name}` : w.full_name]));
  const wpsCode = new Map((wps ?? []).map((w) => [w.id, w.code]));
  const weldCode = new Map(ws.map((w) => [w.id, w.code]));
  const fileOf = (ref: string) => (files ?? []).filter((f) => f.ref_id === ref);
  const count = (s: string) => ws.filter((w) => w.status === s).length;
  const hydroBar = calc?.results ? Math.round(Number((calc.results as { hydro: number }).hydro) * 10 * 10) / 10 : null;
  const back = `/orders/${id}/qa`;
  const savedPlate = o.nameplate as Record<string, string>;
  const hasPlate = Object.keys(savedPlate ?? {}).length > 0;
  const plateVals = hasPlate ? savedPlate : nameplateDefaults(o, calcAny as never);
  const suggest = calcAny?.kind === "tank" ? "tank" : calcAny?.kind === "vessel" ? "vessel" : "structure";

  const Files = ({ cat, refId }: { cat: string; refId: string }) => (
    <span className="row" style={{ gap: 6 }}>
      {fileOf(refId).map((f) => (
        <a key={f.id} href={`/orders/file/${f.id}`} target="_blank" rel="noopener" className="meta" title={fileSize(f.size)}>📎 {f.name}</a>
      ))}
      {edit && <Upload bucket="orders" folder={`${id}/qa`} label="+ مرفق" save={addQualityFiles.bind(null, id, cat, refId)} />}
    </span>
  );

  return (
    <>
      <Alert error={sp.error} ok={sp.ok} />
      <div className="bar">
        <h2>الجودة واللحام · أمر #{o.no} {o.product}</h2>
        <div className="row noprint">
          <Link className="btn" href={`/orders/${id}/databook`}>ملف البيانات Data Book</Link>
          <Link className="btn ghost" href={`/orders/${id}`}>رجوع للأمر</Link>
        </div>
      </div>
      <div className="kpis">
        <div className="kpi"><span>اللحامات</span><b>{ws.length}</b></div>
        <div className="kpi"><span>مقبولة</span><b>{count("accepted")}</b></div>
        <div className="kpi"><span>تنتظر الفحص</span><b>{count("welded")}</b></div>
        <div className="kpi"><span>تحتاج تصليح</span><b className={count("repair") ? "neg" : ""}>{count("repair")}</b></div>
      </div>

      <ItpSection orderId={id} items={itp ?? []} edit={edit} suggest={suggest} />
      <TraceSection orderId={id} rows={trace.rows} missing={trace.missing} files={files ?? []} edit={edit} />

      <h3 className="sec" id="welds">خريطة اللحامات</h3>
      {ws.length ? (
        <div className="tbl">
          <table data-plain>
            <thead><tr><th>الرمز</th><th>النوع</th><th>الوصف</th><th className="n">السمك / الطول</th><th>الفحص المطلوب</th><th>اللحام · WPS · الحالة</th><th></th></tr></thead>
            <tbody>
              {ws.map((w) => (
                <tr key={w.id}>
                  <td className="num"><b>{w.code}</b></td>
                  <td>{WELD_KIND[w.kind]}</td>
                  <td>{w.description}</td>
                  <td className="n num">{w.thickness ? num(w.thickness) : ""}{w.length_mm ? ` / ${num(w.length_mm)}` : ""}</td>
                  <td className="num">{(w.ndt as string[]).join("، ")}</td>
                  <td>
                    {edit ? (
                      <form action={updateWeld} className="row" style={{ gap: 4 }}>
                        <input type="hidden" name="id" value={w.id} />
                        <input type="hidden" name="order_id" value={id} />
                        <select name="welder_id" defaultValue={w.welder_id ?? ""} aria-label="اللحام" style={{ width: 130 }}>
                          <option value="">اللحام</option>
                          {(workers ?? []).map((x) => <option key={x.id} value={x.id}>{wName.get(x.id)}</option>)}
                        </select>
                        <select name="wps_id" defaultValue={w.wps_id ?? ""} aria-label="WPS" style={{ width: 100 }}>
                          <option value="">WPS</option>
                          {(wps ?? []).map((x) => <option key={x.id} value={x.id}>{x.code}</option>)}
                        </select>
                        <select name="status" defaultValue={w.status} aria-label="الحالة" style={{ width: 150 }} className={`tone-${WELD_STATUS[w.status].tone}`}>
                          {Object.entries(WELD_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                        </select>
                        <button className="btn ghost sm" type="submit">حفظ</button>
                      </form>
                    ) : (
                      <span>{w.welder_id ? wName.get(w.welder_id) : ""}{w.wps_id ? ` · ${wpsCode.get(w.wps_id)}` : ""} <span className={`pill tone-${WELD_STATUS[w.status].tone}`}>{WELD_STATUS[w.status].label}</span></span>
                    )}
                  </td>
                  <td>
                    {edit && (
                      <form action={deleteWeld}>
                        <input type="hidden" name="id" value={w.id} />
                        <input type="hidden" name="order_id" value={id} />
                        <button className="btn ghost sm" type="submit" aria-label="حذف">×</button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty">ما بيه لحامات مسجلة. سجلها حتى تعرف منو لحم كل لحامة وشنو نتيجة فحصها.</div>
      )}
      {edit && (
        <form action={saveWeld} className="panel noprint" style={{ marginTop: 10 }}>
          <input type="hidden" name="order_id" value={id} />
          <div className="row">
            <select name="kind" defaultValue="long" aria-label="النوع" style={{ width: 130 }}>
              {Object.entries(WELD_KIND).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <input name="count" type="number" min="1" max="50" defaultValue={1} aria-label="العدد" title="عدد اللحامات" style={{ width: 70 }} />
            <input name="code" placeholder="الرمز (تلقائي)" aria-label="الرمز" style={{ width: 110 }} />
            <input name="description" placeholder="الوصف: بين الحلقة 1 و 2" aria-label="الوصف" style={{ flex: "1 1 180px", width: "auto" }} />
            <input name="thickness" type="number" step="any" placeholder="السمك" aria-label="السمك" style={{ width: 80 }} />
            <input name="length_mm" type="number" step="any" placeholder="الطول ملم" aria-label="الطول" style={{ width: 100 }} />
            <select name="wps_id" defaultValue="" aria-label="WPS" style={{ width: 110 }}>
              <option value="">WPS</option>
              {(wps ?? []).map((x) => <option key={x.id} value={x.id}>{x.code}</option>)}
            </select>
            <select name="welder_id" defaultValue="" aria-label="اللحام" style={{ width: 140 }}>
              <option value="">اللحام</option>
              {(workers ?? []).map((x) => <option key={x.id} value={x.id}>{wName.get(x.id)}</option>)}
            </select>
          </div>
          <div className="row" style={{ marginTop: 8 }}>
            <span className="meta">الفحص المطلوب:</span>
            {Object.keys(NDT_METHODS).filter((k) => k !== "VT").map((k) => (
              <label key={k} className="row" style={{ gap: 4 }}><input type="checkbox" name="ndt" value={k} defaultChecked={k === "RT"} /> {k}</label>
            ))}
            <button className="btn ghost" type="submit" style={{ marginInlineStart: "auto" }}>إضافة لحامة</button>
          </div>
        </form>
      )}

      <h3 className="sec" id="ndt">تقارير الفحص غير الإتلافي</h3>
      {ndt?.length ? (
        <div className="tbl">
          <table data-plain>
            <thead><tr><th>الطريقة</th><th>رقم التقرير</th><th>التاريخ</th><th>الجهة / الفاحص</th><th>اللحامات</th><th>النتيجة</th><th>المرفقات</th><th></th></tr></thead>
            <tbody>
              {ndt.map((r) => (
                <tr key={r.id}>
                  <td>{NDT_METHODS[r.method]}{r.extent ? <div className="meta">{r.extent}</div> : null}</td>
                  <td className="num">{r.report_no}</td>
                  <td className="num">{r.day}</td>
                  <td>{[r.agency, r.inspector].filter(Boolean).join(" · ")}</td>
                  <td className="num">{(r.weld_ids as string[]).map((x) => weldCode.get(x)).filter(Boolean).join("، ")}</td>
                  <td>{r.result === "accept" ? <span className="pill tone-ok">مقبول</span> : <span className="pill tone-bad">مرفوض</span>}</td>
                  <td><Files cat="ndt" refId={r.id} /></td>
                  <td>{edit && <form action={deleteNdt}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="order_id" value={id} /><button className="btn ghost sm" type="submit" aria-label="حذف">×</button></form>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="meta">ما بيه تقارير فحص بعد.</p>}
      {edit && (
        <details className="noprint" style={{ marginTop: 10 }}>
          <summary className="btn ghost">+ تسجيل تقرير فحص</summary>
        <form action={saveNdt} className="panel" style={{ marginTop: 8 }}>
          <input type="hidden" name="order_id" value={id} />
          <div className="fields">
            <label>الطريقة<select name="method" defaultValue="RT">{Object.entries(NDT_METHODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
            <label>رقم التقرير<input name="report_no" /></label>
            <label>التاريخ<input name="day" type="date" defaultValue={today()} /></label>
            <label>الجهة الفاحصة<input name="agency" /></label>
            <label>الفاحص<input name="inspector" /></label>
            <label>النسبة<input name="extent" placeholder="100% أو 10% نقطي" /></label>
            <label>النتيجة<select name="result" defaultValue="accept"><option value="accept">مقبول</option><option value="reject">مرفوض</option></select></label>
            <label className="full">ملاحظات<input name="notes" /></label>
          </div>
          {ws.length > 0 && (
            <div className="checks" style={{ marginTop: 8 }}>
              {ws.map((w) => <label key={w.id}><input type="checkbox" name="weld_ids" value={w.id} defaultChecked={w.status === "welded" && (w.ndt as string[]).length > 0} /> {w.code}</label>)}
            </div>
          )}
          <div className="actions"><button className="btn ghost" type="submit">تسجيل التقرير</button></div>
          <p className="meta" style={{ marginBottom: 0 }}>النتيجة تنعكس على اللحامات المأشرة: مقبول أو يحتاج تصليح. ارفع التقرير الموقع بعد التسجيل من «+ مرفق».</p>
        </form>
        </details>
      )}

      <h3 className="sec" id="hydro">الاختبار المائي</h3>
      {hydro?.length ? (
        <div className="tbl">
          <table data-plain>
            <thead><tr><th>التاريخ</th><th className="n">ضغط التصميم</th><th className="n">ضغط الاختبار</th><th className="n">المدة</th><th>المانوميتر</th><th>الشاهد</th><th>النتيجة</th><th>الصور</th><th></th></tr></thead>
            <tbody>
              {hydro.map((h) => (
                <tr key={h.id}>
                  <td className="num">{h.day}</td>
                  <td className="n num">{h.design_bar ? `${num(h.design_bar)} bar` : ""}</td>
                  <td className="n num">{num(h.test_bar)} bar</td>
                  <td className="n num">{h.hold_min} د</td>
                  <td className="num">{h.gauge_no}{h.gauge_cal_due ? <div className="meta">معايرة لحد {h.gauge_cal_due}</div> : null}</td>
                  <td>{h.witness}</td>
                  <td>{h.result === "pass" ? <span className="pill tone-ok">ناجح</span> : <span className="pill tone-bad">فاشل</span>}</td>
                  <td><Files cat="hydro" refId={h.id} /></td>
                  <td>{edit && <form action={deleteHydro}><input type="hidden" name="id" value={h.id} /><input type="hidden" name="order_id" value={id} /><button className="btn ghost sm" type="submit" aria-label="حذف">×</button></form>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="meta">ما انسوى اختبار مائي بعد.</p>}
      {edit && (
        <details className="noprint" style={{ marginTop: 10 }}>
          <summary className="btn ghost">+ تسجيل اختبار مائي</summary>
        <form action={saveHydro} className="panel" style={{ marginTop: 8 }}>
          <input type="hidden" name="order_id" value={id} />
          <div className="fields">
            <label>التاريخ<input name="day" type="date" defaultValue={today()} /></label>
            <label>ضغط التصميم (bar)<input name="design_bar" type="number" step="any" /></label>
            <label>ضغط الاختبار (bar)<input name="test_bar" type="number" step="any" required defaultValue={hydroBar ?? undefined} /></label>
            <label>مدة الثبات (دقيقة)<input name="hold_min" type="number" defaultValue={30} /></label>
            <label>الحرارة (°م)<input name="temp_c" type="number" step="any" /></label>
            <label>رقم المانوميتر<input name="gauge_no" /></label>
            <label>المعايرة صالحة لحد<input name="gauge_cal_due" type="date" /></label>
            <label>الشاهد<input name="witness" placeholder="ممثل الزبون أو المفتش" /></label>
            <label>النتيجة<select name="result" defaultValue="pass"><option value="pass">ناجح</option><option value="fail">فاشل</option></select></label>
            <label className="full">ملاحظات<input name="notes" /></label>
          </div>
          <div className="actions"><button className="btn ghost" type="submit">تسجيل الاختبار</button></div>
          {hydroBar && <p className="meta" style={{ marginBottom: 0 }}>الضغط المقترح {hydroBar} bar من الحساب الهندسي (1.3 × MAWP).</p>}
        </form>
        </details>
      )}

      <h3 className="sec">عدم المطابقة</h3>
      {ncrs?.length ? (
        <ul className="stages panel">
          {ncrs.map((r) => (
            <li key={r.id}>
              <span className="num meta">NCR-{r.no} · {r.day}</span>
              <span className="name">{r.description}{r.action ? <span className="meta"> ← {r.action}</span> : null}</span>
              {r.status === "open" ? <span className="pill tone-bad">مفتوحة</span> : <span className="pill tone-ok">مغلقة</span>}
              <Files cat="ncr" refId={r.id} />
              {edit && <form action={deleteNcr}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="back" value={back} /><button className="btn ghost sm" type="submit" aria-label="حذف">×</button></form>}
            </li>
          ))}
        </ul>
      ) : null}
      {edit && (
        <form action={saveNcr} className="row noprint" style={{ marginTop: 8 }}>
          <input type="hidden" name="order_id" value={id} />
          <input type="hidden" name="back" value={back} />
          <select name="source" defaultValue="internal" aria-label="المصدر" style={{ width: 120 }}>{Object.entries(NCR_SOURCE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          <input name="description" required placeholder="المشكلة" aria-label="المشكلة" style={{ flex: "1 1 200px", width: "auto" }} />
          <input name="action" placeholder="الإجراء" aria-label="الإجراء" style={{ flex: "1 1 160px", width: "auto" }} />
          <input name="cost" type="number" step="any" placeholder="الكلفة" aria-label="الكلفة" style={{ width: 110 }} />
          <button className="btn ghost" type="submit">تسجيل NCR</button>
        </form>
      )}

      <NameplateSection orderId={id} values={plateVals} saved={hasPlate} edit={edit} />
    </>
  );
}
