import { Upload } from "@/components/upload";
import { fileSize, num, today } from "@/lib/labels";
import { ITP_STATUS, ITP_TEMPLATES, NAMEPLATE_FIELDS, POINT } from "@/lib/itp";
import type { TraceRow } from "@/lib/traceability";
import { addQualityFiles, deleteCert, deleteItpItem, generateItp, saveCert, saveItpItem, saveNameplate, setItpStatus } from "../../../quality/actions";

type FileRow = { id: string; name: string; size: number; ref_id: string | null; category: string };

// مرفقات سجل معيّن (تقرير، شهادة مصنع، صور)
export function QaFiles({ orderId, files, cat, refId, edit }: { orderId: string; files: FileRow[]; cat: string; refId: string; edit: boolean }) {
  return (
    <span className="row" style={{ gap: 6 }}>
      {files.filter((f) => f.ref_id === refId).map((f) => (
        <a key={f.id} href={`/orders/file/${f.id}`} target="_blank" rel="noopener" className="meta" title={fileSize(f.size)}>📎 {f.name}</a>
      ))}
      {edit && <Upload bucket="orders" folder={`${orderId}/qa`} label="+ مرفق" save={addQualityFiles.bind(null, orderId, cat, refId)} />}
    </span>
  );
}

const Pt = ({ v }: { v: string | null }) => (v ? <b className="num" title={POINT[v]?.hint}>{v}</b> : <span className="meta">-</span>);

type ItpItem = { id: string; seq: number; activity: string; reference: string | null; acceptance: string | null; record: string | null; factory: string | null; client: string | null; tpi: string | null; status: string; done_on: string | null; done_by: string | null };

export function ItpSection({ orderId, items, edit, suggest }: { orderId: string; items: ItpItem[]; edit: boolean; suggest: string }) {
  const doneN = items.filter((i) => i.status !== "pending").length;
  return (
    <>
      <h3 className="sec" id="itp">خطة الفحص والاختبار ITP {items.length > 0 && <span className="meta num">· {doneN} من {items.length}</span>}</h3>
      {items.length ? (
        <div className="tbl">
          <table data-plain>
            <thead><tr><th>#</th><th>النشاط والمرجع</th><th>معيار القبول</th><th>السجل</th><th title="المعمل">المعمل</th><th title="الزبون">الزبون</th><th title="جهة التفتيش الثالثة">TPI</th><th>الحالة</th><th></th></tr></thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id}>
                  <td className="num">{i.seq}</td>
                  <td style={{ whiteSpace: "normal", minWidth: 180 }}>{i.activity}{i.reference ? <div className="meta">{i.reference}</div> : null}</td>
                  <td style={{ whiteSpace: "normal", minWidth: 160 }}><span className="meta">{i.acceptance}</span></td>
                  <td style={{ whiteSpace: "normal" }}><span className="meta">{i.record}</span></td>
                  <td><Pt v={i.factory} /></td>
                  <td><Pt v={i.client} /></td>
                  <td><Pt v={i.tpi} /></td>
                  <td>
                    {i.status === "pending" ? (
                      edit ? (
                        <form action={setItpStatus} className="row" style={{ gap: 4, flexWrap: "nowrap" }}>
                          <input type="hidden" name="id" value={i.id} />
                          <input type="hidden" name="order_id" value={orderId} />
                          <input name="done_by" placeholder="الموقّع" aria-label="الموقّع" style={{ width: 96 }} />
                          <button className="btn ghost sm" type="submit" name="status" value="done">تم ✓</button>
                          <button className="btn ghost sm" type="submit" name="status" value="na" title="لا ينطبق">N/A</button>
                        </form>
                      ) : <span className="pill tone-mut">{ITP_STATUS.pending.label}</span>
                    ) : (
                      <div className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
                        <span className={`pill tone-${ITP_STATUS[i.status]?.tone}`}>{ITP_STATUS[i.status]?.label}</span>
                        <span className="meta num">{[i.done_on, i.done_by].filter(Boolean).join(" · ")}</span>
                        {edit && (
                          <form action={setItpStatus}>
                            <input type="hidden" name="id" value={i.id} />
                            <input type="hidden" name="order_id" value={orderId} />
                            <input type="hidden" name="status" value="pending" />
                            <button className="btn ghost sm" type="submit" title="إرجاع لينتظر" aria-label="إرجاع لينتظر">↺</button>
                          </form>
                        )}
                      </div>
                    )}
                  </td>
                  <td>{edit && <form action={deleteItpItem}><input type="hidden" name="id" value={i.id} /><input type="hidden" name="order_id" value={orderId} /><button className="btn ghost sm" type="submit" aria-label="حذف">×</button></form>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="meta">ما اكو خطة فحص لهذا الأمر بعد.</p>
      )}
      <p className="meta">
        {Object.entries(POINT).map(([k, v]) => <span key={k} style={{ marginInlineEnd: 12 }}><b className="num">{k}</b> {v.hint}</span>)}
      </p>
      {edit && !items.length && (
        <form action={generateItp} className="row noprint">
          <input type="hidden" name="order_id" value={orderId} />
          <select name="template" defaultValue={suggest} aria-label="القالب" style={{ width: 220 }}>
            {Object.entries(ITP_TEMPLATES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <button className="btn" type="submit">إنشاء الخطة من القالب</button>
        </form>
      )}
      {edit && items.length > 0 && (
        <details className="noprint" style={{ marginTop: 10 }}>
          <summary className="btn ghost">+ بند للخطة</summary>
          <form action={saveItpItem} className="panel" style={{ marginTop: 8 }}>
            <input type="hidden" name="order_id" value={orderId} />
            <div className="fields">
              <label className="full">النشاط<input name="activity" required /></label>
              <label>المرجع<input name="reference" /></label>
              <label>معيار القبول<input name="acceptance" /></label>
              <label>السجل<input name="record" /></label>
              {(["factory", "client", "tpi"] as const).map((k) => (
                <label key={k}>{k === "factory" ? "المعمل" : k === "client" ? "الزبون" : "TPI"}
                  <select name={k} defaultValue={k === "factory" ? "W" : ""}><option value="">-</option>{Object.keys(POINT).map((p) => <option key={p} value={p}>{p}</option>)}</select>
                </label>
              ))}
            </div>
            <div className="actions"><button className="btn ghost" type="submit">إضافة</button></div>
          </form>
        </details>
      )}
    </>
  );
}

export function TraceSection({ orderId, rows, missing, files, edit }: { orderId: string; rows: TraceRow[]; missing: number; files: FileRow[]; edit: boolean }) {
  return (
    <>
      <h3 className="sec" id="trace">تتبع المواد ورقم الصبة</h3>
      {missing > 0 && <p className="meta"><span className="pill tone-warn">{missing} بند بدون رقم صبة</span> سجّل رقم الصبة على اللوح من صفحة الألواح، أو بالمادة اليدوية.</p>}
      {rows.length ? (
        <div className="tbl">
          <table data-plain>
            <thead><tr><th>القطعة / المادة</th><th className="n">العدد</th><th>الدرجة</th><th className="n">السمك</th><th>المصدر</th><th>رقم الصبة</th><th>الشهادة MTC</th><th></th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key}>
                  <td>{r.part}</td>
                  <td className="n num">{r.qty ? num(r.qty) : ""}</td>
                  <td className="num">{r.grade}</td>
                  <td className="n num"><bdi className="ltr">{r.thickness ? num(r.thickness) : r.size ?? ""}</bdi></td>
                  <td className="meta">{r.source}</td>
                  <td className="num">{r.heat_no ? <b>{r.heat_no}</b> : <span className="pill tone-warn">ناقص</span>}</td>
                  <td className="num">{r.cert_no}<div><QaFiles orderId={orderId} files={files} cat="mtc" refId={r.ref} edit={edit} /></div></td>
                  <td>{edit && r.manual && <form action={deleteCert}><input type="hidden" name="id" value={r.ref} /><input type="hidden" name="order_id" value={orderId} /><button className="btn ghost sm" type="submit" aria-label="حذف">×</button></form>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="meta">القطع تنضاف هنا تلقائياً من مخططات القص المنجزة. الأنابيب والفلنجات والرؤوس المشتراة سجلها يدوياً.</p>
      )}
      {edit && (
        <details className="noprint" style={{ marginTop: 10 }}>
          <summary className="btn ghost">+ مادة يدوية (أنبوب، فلنج، رأس مشترى...)</summary>
          <form action={saveCert} className="panel" style={{ marginTop: 8 }}>
            <input type="hidden" name="order_id" value={orderId} />
            <div className="fields">
              <label className="full">الوصف<input name="item" required placeholder={'فلنج 4" 150# WN'} /></label>
              <label>الدرجة<input name="grade" placeholder="A105" /></label>
              <label>المقاس<input name="size" /></label>
              <label>العدد<input name="qty" type="number" step="any" /></label>
              <label>رقم الصبة<input name="heat_no" /></label>
              <label>رقم الشهادة<input name="cert_no" /></label>
              <label>المورد<input name="supplier" /></label>
            </div>
            <div className="actions"><button className="btn ghost" type="submit">إضافة</button></div>
          </form>
        </details>
      )}
    </>
  );
}

export function NameplateSection({ orderId, values, saved, edit }: { orderId: string; values: Record<string, string>; saved: boolean; edit: boolean }) {
  return (
    <>
      <h3 className="sec" id="nameplate">لوحة الاسم ومعلومات التصميم {!saved && <span className="pill tone-info">قيم مقترحة</span>}</h3>
      {edit ? (
        <form action={saveNameplate} className="panel">
          <input type="hidden" name="order_id" value={orderId} />
          <div className="fields">
            {NAMEPLATE_FIELDS.map(([k, l]) => <label key={k}>{l}<input name={`np_${k}`} defaultValue={values[k] ?? ""} /></label>)}
          </div>
          <div className="actions"><button className="btn ghost" type="submit">حفظ لوحة الاسم</button></div>
          {!saved && <p className="meta" style={{ marginBottom: 0 }}>القيم مأخوذة من الحساب الهندسي المرتبط بالأمر. راجعها واحفظ. تاريخ اليوم {today()}.</p>}
        </form>
      ) : (
        <div className="tbl"><table data-plain><tbody>{NAMEPLATE_FIELDS.filter(([k]) => values[k]).map(([k, l]) => <tr key={k}><th>{l}</th><td className="num"><bdi className="ltr">{values[k]}</bdi></td></tr>)}</tbody></table></div>
      )}
    </>
  );
}
