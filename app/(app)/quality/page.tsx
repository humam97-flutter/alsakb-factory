import { Alert, type PageProps } from "@/components/ui";
import { can, getMe } from "@/lib/auth";
import { addDays, today } from "@/lib/labels";
import { PROCESSES, qualState } from "@/lib/quality";
import { supabase } from "@/lib/supabase/server";
import { deleteQual, saveQual, setStamp } from "./actions";

// اللحامين: الرمز، المؤهلات (WPQ) وتواريخ انتهائها، وكم لحامة لحم
export default async function WeldersPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const me = await getMe();
  const edit = can.production(me.role);
  const db = await supabase();
  const [{ data: workers }, { data: quals }, { data: wps }, { data: welds }] = await Promise.all([
    db.from("workers").select("id, full_name, job, welder_stamp").eq("active", true).order("full_name"),
    db.from("welder_quals").select("*, wps:wps(code)").order("expires_on"),
    db.from("wps").select("id, code, process").eq("active", true).order("code"),
    db.from("welds").select("welder_id, status"),
  ]);
  const t = today(), soon = addDays(t, 30);
  const byWorker = new Map<string, typeof quals>();
  for (const q of quals ?? []) byWorker.set(q.worker_id, [...(byWorker.get(q.worker_id) ?? []), q]);
  const stats = new Map<string, { n: number; rep: number }>();
  for (const w of welds ?? []) {
    if (!w.welder_id || w.status === "pending") continue;
    const s = stats.get(w.welder_id) ?? { n: 0, rep: 0 };
    s.n++;
    if (w.status === "repair") s.rep++;
    stats.set(w.welder_id, s);
  }
  // اللي عنده رمز أو مؤهل أولاً
  const ws = (workers ?? []).filter((w) => w.welder_stamp || byWorker.has(w.id) || /لح/.test(w.job ?? ""));
  const others = (workers ?? []).filter((w) => !ws.includes(w));

  return (
    <>
      <Alert error={sp.error} ok={sp.ok} />
      <div className="bar"><h2>اللحامين ومؤهلاتهم</h2></div>
      {!ws.length ? (
        <div className="empty">ما بيه لحامين مسجلين. أضف مؤهل للحام من النموذج تحت، أو اكتب «لحام» بمهنة العامل.</div>
      ) : (
        <div className="tbl">
          <table>
            <thead><tr><th>اللحام</th><th>الرمز</th><th>المؤهلات</th><th className="n">لحامات</th><th className="n">نسبة التصليح</th></tr></thead>
            <tbody>
              {ws.map((w) => {
                const s = stats.get(w.id);
                return (
                  <tr key={w.id}>
                    <td>{w.full_name}<div className="meta">{w.job}</div></td>
                    <td>
                      {edit ? (
                        <form action={setStamp} className="row" style={{ gap: 4, flexWrap: "nowrap" }}>
                          <input type="hidden" name="worker_id" value={w.id} />
                          <input name="welder_stamp" defaultValue={w.welder_stamp ?? ""} aria-label="رمز اللحام" style={{ width: 70 }} />
                          <button className="btn ghost sm" type="submit">حفظ</button>
                        </form>
                      ) : <span className="num">{w.welder_stamp}</span>}
                    </td>
                    <td>
                      {(byWorker.get(w.id) ?? []).map((q) => {
                        const st = qualState(q.expires_on, t, soon);
                        return (
                          <div key={q.id} className="row" style={{ gap: 6, marginBottom: 4 }}>
                            <span className={`pill tone-${st.tone}`}>{st.label}</span>
                            <span className="num" style={{ fontSize: 13 }}>
                              {q.process}{q.positions ? ` · ${q.positions}` : ""}{q.thickness_range ? ` · ${q.thickness_range}` : ""}{(q.wps as { code: string } | null)?.code ? ` · ${(q.wps as { code: string }).code}` : ""}
                            </span>
                            <span className="meta num">{q.cert_no}{q.expires_on ? ` · لحد ${q.expires_on}` : ""}</span>
                            {edit && (
                              <form action={deleteQual}>
                                <input type="hidden" name="id" value={q.id} />
                                <button className="btn ghost sm" type="submit" aria-label="حذف">×</button>
                              </form>
                            )}
                          </div>
                        );
                      })}
                    </td>
                    <td className="n num">{s?.n ?? 0}</td>
                    <td className={`n num ${s && s.n && s.rep / s.n > 0.05 ? "neg" : ""}`}>{s?.n ? `${((s.rep / s.n) * 100).toFixed(1)}%` : ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {edit && (
        <>
          <h3 className="sec">إضافة مؤهل لحام (WPQ)</h3>
          <form action={saveQual} className="panel">
            <div className="fields">
              <label>
                اللحام
                <select name="worker_id" required defaultValue="">
                  <option value="" disabled>اختار</option>
                  {[...ws, ...others].map((w) => <option key={w.id} value={w.id}>{w.full_name}</option>)}
                </select>
              </label>
              <label>
                الطريقة
                <select name="process" defaultValue="SMAW">{PROCESSES.map((p) => <option key={p}>{p}</option>)}</select>
              </label>
              <label>
                على إجراء WPS
                <select name="wps_id" defaultValue="">
                  <option value="">بدون</option>
                  {(wps ?? []).map((x) => <option key={x.id} value={x.id}>{x.code} · {x.process}</option>)}
                </select>
              </label>
              <label>الأوضاع<input name="positions" placeholder="6G (كل الأوضاع)" /></label>
              <label>مدى السمك<input name="thickness_range" placeholder="5 إلى 24 ملم" /></label>
              <label>رقم الشهادة<input name="cert_no" /></label>
              <label>تاريخ الإصدار<input name="issued_on" type="date" /></label>
              <label>تاريخ الانتهاء<input name="expires_on" type="date" /></label>
              <label className="full">ملاحظات<input name="notes" /></label>
            </div>
            <div className="actions"><button className="btn" type="submit">إضافة</button></div>
            <p className="meta" style={{ marginBottom: 0 }}>المؤهل اللي ينتهي خلال 30 يوم يطلع بالتنبيهات. حسب ASME IX يسقط المؤهل إذا اللحام ما استخدم الطريقة 6 أشهر، والبرنامج يحدث «آخر استخدام» من خريطة اللحامات.</p>
          </form>
        </>
      )}
    </>
  );
}
