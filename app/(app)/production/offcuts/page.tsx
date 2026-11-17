import { Alert, Input, Select, type PageProps } from "@/components/ui";
import { getMe } from "@/lib/auth";
import { num } from "@/lib/labels";
import { supabase } from "@/lib/supabase/server";
import { deleteOffcut, saveOffcut, useOffcut } from "../actions";

// بقايا الصاج: قبل ما تقص لوح جديد، شوف إذا اكو قطعة تكفي
export default async function OffcutsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const me = await getMe();
  const edit = ["manager", "production", "storekeeper"].includes(me.role);
  const db = await supabase();
  let q = db
    .from("offcuts")
    .select("*, material:materials(name, spec), from:work_orders!from_order_id(no)")
    .is("used_order_id", null)
    .order("thickness")
    .order("length_mm", { ascending: false });
  const minL = Number(sp.l || 0), minW = Number(sp.w || 0), t = Number(sp.t || 0);
  if (t) q = q.eq("thickness", t);
  const [{ data: rows }, { data: materials }, { data: orders }] = await Promise.all([
    q,
    db.from("materials").select("id, name, spec").order("name"),
    db.from("work_orders").select("id, no, product").in("status", ["new", "in_progress", "on_hold"]).order("no", { ascending: false }),
  ]);
  // القطعة تنفع إذا تكفي بأي اتجاه
  const fits = (r: { length_mm: number | null; width_mm: number | null }) => {
    const L = Number(r.length_mm ?? 0), W = Number(r.width_mm ?? 0);
    return (L >= minL && W >= minW) || (L >= minW && W >= minL);
  };
  const list = (rows ?? []).filter((r) => (!minL && !minW) || fits(r));
  const orderOpts = Object.fromEntries((orders ?? []).map((o) => [o.id, `#${o.no} · ${o.product}`]));

  return (
    <>
      <Alert error={sp.error} ok={sp.ok} />
      <form className="bar" method="get">
        <h2>بقايا الصاج</h2>
        <input name="t" type="number" step="any" placeholder="السمك ملم" defaultValue={sp.t} aria-label="السمك" style={{ width: 110 }} />
        <input name="l" type="number" step="any" placeholder="أحتاج طول ملم" defaultValue={sp.l} aria-label="الطول المطلوب" style={{ width: 130 }} />
        <input name="w" type="number" step="any" placeholder="وعرض ملم" defaultValue={sp.w} aria-label="العرض المطلوب" style={{ width: 120 }} />
        <button className="btn ghost" type="submit">بحث عن قطعة تكفي</button>
      </form>

      {!list.length ? (
        <div className="empty">{minL || minW || t ? "ما بيه قطعة تكفي بهذا القياس." : "ما بيه بقايا مسجلة."}</div>
      ) : (
        <div className="tbl">
          <table>
            <thead><tr><th>المادة</th><th className="n">السمك</th><th className="n">الطول × العرض (ملم)</th><th className="n">العدد</th><th>المكان</th><th>من أمر</th><th></th></tr></thead>
            <tbody>
              {list.map((r) => {
                const m = r.material as { name: string; spec: string | null } | null;
                const from = r.from as { no: number } | null;
                return (
                  <tr key={r.id}>
                    <td>{m ? `${m.name}${m.spec ? " · " + m.spec : ""}` : r.description}{m && r.description ? <div className="meta">{r.description}</div> : null}</td>
                    <td className="n num">{r.thickness ? num(r.thickness) : ""}</td>
                    <td className="n num">{r.length_mm ? `${num(r.length_mm)} × ${num(r.width_mm)}` : ""}</td>
                    <td className="n num">{r.pieces}</td>
                    <td>{r.location}</td>
                    <td className="num">{from ? `#${from.no}` : ""}</td>
                    <td>
                      {edit && (
                        <div className="row" style={{ gap: 4 }}>
                          <form action={useOffcut} className="row" style={{ gap: 4 }}>
                            <input type="hidden" name="id" value={r.id} />
                            <select name="order_id" required aria-label="لأي أمر" style={{ width: 150 }} defaultValue="">
                              <option value="" disabled>انصرفت لأمر…</option>
                              {Object.entries(orderOpts).map(([k, v]) => <option key={k} value={k}>{String(v)}</option>)}
                            </select>
                            <button className="btn ghost sm" type="submit">صرف</button>
                          </form>
                          <form action={deleteOffcut}>
                            <input type="hidden" name="id" value={r.id} />
                            <button className="btn ghost sm" type="submit" aria-label="حذف">×</button>
                          </form>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {edit && (
        <>
          <h3 className="sec">إضافة قطعة متبقية</h3>
          <form action={saveOffcut} className="panel">
            <div className="fields">
              <Select name="material_id" label="المادة الأصلية" options={Object.fromEntries((materials ?? []).map((m) => [m.id, `${m.name}${m.spec ? " · " + m.spec : ""}`]))} full />
              <Input name="description" label="وصف (اختياري)" full />
              <Input name="thickness" label="السمك (ملم)" type="number" />
              <Input name="length_mm" label="الطول (ملم)" type="number" />
              <Input name="width_mm" label="العرض (ملم)" type="number" />
              <Input name="pieces" label="العدد" type="number" value={1} />
              <Input name="location" label="مكانها بالمعمل" />
              <Select name="from_order_id" label="بقت من أمر" options={orderOpts} />
            </div>
            <div className="actions"><button className="btn" type="submit">إضافة</button></div>
          </form>
        </>
      )}
      <p className="meta" style={{ marginTop: 12 }}>القطعة اللي تنصرف لأمر تنشال من القائمة.</p>
    </>
  );
}
