import { Alert, type PageProps } from "@/components/ui";
import { can, getMe } from "@/lib/auth";
import { PROCESSES } from "@/lib/quality";
import { supabase } from "@/lib/supabase/server";
import { deleteWps, saveWps } from "../actions";

export default async function WpsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const me = await getMe();
  const edit = can.production(me.role);
  const db = await supabase();
  const { data } = await db.from("wps").select("*").order("code");
  return (
    <>
      <Alert error={sp.error} ok={sp.ok} />
      <div className="bar"><h2>إجراءات اللحام (WPS / PQR)</h2></div>
      {!data?.length ? (
        <div className="empty">ما بيه إجراءات لحام مسجلة. سجل الـ WPS المعتمدة عندكم حتى تربطها باللحامين واللحامات.</div>
      ) : (
        <div className="tbl">
          <table>
            <thead><tr><th>الرمز</th><th>الطريقة</th><th>المعدن الأساسي</th><th>السمك</th><th>سلك الحشو</th><th>الأوضاع</th><th>PQR</th><th></th></tr></thead>
            <tbody>
              {data.map((w) => (
                <tr key={w.id} style={w.active ? undefined : { opacity: 0.55 }}>
                  <td className="num"><b>{w.code}</b></td>
                  <td className="num">{w.process}</td>
                  <td>{w.base_metal}</td>
                  <td>{w.thickness_range}</td>
                  <td className="num">{w.filler}</td>
                  <td>{w.positions}</td>
                  <td className="num">{w.pqr_no}</td>
                  <td>
                    {edit && (
                      <form action={deleteWps}>
                        <input type="hidden" name="id" value={w.id} />
                        <button className="btn ghost sm" type="submit" aria-label="حذف">×</button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {edit && (
        <>
          <h3 className="sec">إضافة إجراء</h3>
          <form action={saveWps} className="panel">
            <div className="fields">
              <label>الرمز<input name="code" required placeholder="WPS-001" /></label>
              <label>
                الطريقة
                <select name="process" defaultValue="SMAW">{PROCESSES.map((p) => <option key={p}>{p}</option>)}</select>
              </label>
              <label>المعدن الأساسي<input name="base_metal" placeholder="P-No.1 (SA-516 Gr70)" /></label>
              <label>مدى السمك<input name="thickness_range" placeholder="5 إلى 40 ملم" /></label>
              <label>سلك أو قطب الحشو<input name="filler" placeholder="E7018" /></label>
              <label>الأوضاع<input name="positions" placeholder="الكل" /></label>
              <label>رقم PQR<input name="pqr_no" /></label>
              <label className="full">ملاحظات (التسخين المسبق، المعالجة الحرارية...)<input name="notes" /></label>
            </div>
            <div className="actions"><button className="btn" type="submit">إضافة</button></div>
            <p className="meta" style={{ marginBottom: 0 }}>نسخة الـ WPS الموقعة ترفعها بقسم المستندات حتى تنطبع ويا ملف البيانات.</p>
          </form>
        </>
      )}
    </>
  );
}
