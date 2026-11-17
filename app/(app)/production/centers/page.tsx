import { Alert, type PageProps } from "@/components/ui";
import { can, getMe } from "@/lib/auth";
import { num } from "@/lib/labels";
import { CENTER_KIND, centerColor, dayCapacity } from "@/lib/planning";
import { supabase } from "@/lib/supabase/server";
import { deleteCenter, saveCenter, setMachineCenter } from "../planning-actions";

const COLORS = [0, 1, 2, 3, 4, 5, 6];

// مراكز العمل: كل مركز وطاقته اليومية والمكائن اللي بيه
export default async function CentersPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const me = await getMe();
  const edit = can.production(me.role);
  const db = await supabase();
  const [{ data: centers }, { data: machines }] = await Promise.all([
    db.from("work_centers").select("*").order("position"),
    db.from("machines").select("id, code, name, work_center_id").order("code"),
  ]);
  const cs = centers ?? [];
  const Swatch = ({ c }: { c: number }) => <span aria-hidden="true" style={{ display: "inline-block", width: 12, height: 12, borderRadius: 3, background: centerColor(c), verticalAlign: "middle" }} />;
  const Fields = ({ c }: { c?: (typeof cs)[number] }) => (
    <>
      <input name="code" defaultValue={c?.code ?? ""} required aria-label="الرمز" placeholder="الرمز" style={{ width: 80 }} />
      <input name="name" defaultValue={c?.name ?? ""} required aria-label="الاسم" placeholder="الاسم" style={{ flex: "1 1 160px", width: "auto" }} />
      <select name="kind" defaultValue={c?.kind ?? "other"} aria-label="النوع" style={{ width: 90 }}>{Object.entries(CENTER_KIND).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
      <label className="row" style={{ gap: 4 }}><span className="meta">ساعة/يوم</span><input name="hours_day" type="number" step="any" defaultValue={c?.hours_day ?? 8} style={{ width: 64 }} /></label>
      <label className="row" style={{ gap: 4 }}><span className="meta">عمال</span><input name="people" type="number" min={1} defaultValue={c?.people ?? 1} style={{ width: 56 }} /></label>
      <label className="row" style={{ gap: 4 }}><span className="meta">الكفاءة %</span><input name="efficiency" type="number" step="any" defaultValue={c?.efficiency ?? 85} style={{ width: 64 }} /></label>
      <select name="color" defaultValue={c?.color ?? 0} aria-label="اللون" style={{ width: 64 }}>{COLORS.map((n) => <option key={n} value={n}>{n + 1}</option>)}</select>
    </>
  );
  return (
    <>
      <Alert error={sp.error} ok={sp.ok} />
      <div className="bar"><h2>مراكز العمل</h2></div>
      <p className="meta">الطاقة اليومية = الساعات × العمال × الكفاءة. منها ينحسب كم يوم تاخذ كل مرحلة، وحمل كل مركز بالأسابيع الجاية.</p>
      <div className="panel">
        <ul className="stages">
          {cs.map((c) => (
            <li key={c.id} style={c.active ? undefined : { opacity: 0.55 }}>
              <Swatch c={c.color} />
              {edit ? (
                <form action={saveCenter} className="row" style={{ flex: 1, gap: 6 }}>
                  <input type="hidden" name="id" value={c.id} />
                  <Fields c={c} />
                  <span className="pill tone-info num" title="ساعة فعلية باليوم">{num(Math.round(dayCapacity(c) * 10) / 10)} س/يوم</span>
                  <button className="btn ghost sm" type="submit">حفظ</button>
                </form>
              ) : (
                <span className="name">{c.code} · {c.name} <span className="meta num">{num(Math.round(dayCapacity(c) * 10) / 10)} ساعة فعلية/يوم</span></span>
              )}
              {edit && <form action={deleteCenter}><input type="hidden" name="id" value={c.id} /><button className="btn ghost sm" type="submit" aria-label="حذف">×</button></form>}
            </li>
          ))}
        </ul>
        {edit && (
          <details className="noprint" style={{ marginTop: 10 }}>
            <summary className="btn ghost">+ مركز عمل</summary>
            <form action={saveCenter} className="row" style={{ marginTop: 8, gap: 6 }}>
              <Fields />
              <button className="btn" type="submit">إضافة</button>
            </form>
          </details>
        )}
      </div>

      <h3 className="sec">المكائن على مراكز العمل</h3>
      {machines?.length ? (
        <div className="tbl">
          <table data-plain>
            <thead><tr><th>الماكنة</th><th>مركز العمل</th></tr></thead>
            <tbody>
              {machines.map((m) => (
                <tr key={m.id}>
                  <td>{m.code}. {m.name}</td>
                  <td>
                    {edit ? (
                      <form action={setMachineCenter} className="row" style={{ gap: 6 }}>
                        <input type="hidden" name="machine_id" value={m.id} />
                        <select name="work_center_id" defaultValue={m.work_center_id ?? ""} aria-label="مركز العمل" style={{ width: 200 }}>
                          <option value="">-</option>
                          {cs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        <button className="btn ghost sm" type="submit">حفظ</button>
                      </form>
                    ) : cs.find((c) => c.id === m.work_center_id)?.name}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="meta">ما اكو مكائن مسجلة.</p>}
    </>
  );
}
