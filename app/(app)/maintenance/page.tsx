import Link from "next/link";
import { Alert, Pill, type PageProps } from "@/components/ui";
import { can, getMe } from "@/lib/auth";
import { addDays, MAINT_KIND, MAINT_STATE, money, today } from "@/lib/labels";
import { deletePlan, donePlan, savePlan } from "../production/actions";
import { supabase } from "@/lib/supabase/server";

export default async function MaintenancePage({ searchParams }: PageProps) {
  const { error, ok } = await searchParams;
  const me = await getMe();
  const db = await supabase();
  const [{ data: rows }, { data: plans }, { data: machines }, { data: costs }] = await Promise.all([
    db.from("maintenance").select("*, machine:machines(code, name)").order("day", { ascending: false }).limit(200),
    db.from("maintenance_plans").select("*, machine:machines(code, name)").eq("active", true).order("next_due"),
    db.from("machines").select("id, code, name"),
    db.from("maintenance_costs").select("maintenance_id, cost_total"),
  ]);
  const costOf = new Map((costs ?? []).map((c) => [c.maintenance_id, Number(c.cost_total)]));
  const t = today();
  const editPlans = can.production(me.role);
  const open = (rows ?? []).filter((r) => r.state !== "done");
  const done = (rows ?? []).filter((r) => r.state === "done");
  const table = (list: typeof open) => (
    <div className="tbl">
      <table>
        <thead><tr><th>التاريخ</th><th>الماكنة</th><th>النوع</th><th>الحالة</th><th>الوصف</th><th>نفذها</th><th className="n">الكلفة</th></tr></thead>
        <tbody>
          {list.map((r) => {
            const m = r.machine as { code: string; name: string };
            return (
              <tr key={r.id}>
                <td className="num">{can.production(me.role) ? <Link href={`/maintenance/${r.id}`}>{r.day}</Link> : r.day}</td>
                <td>{m.code}. {m.name}</td>
                <td><Pill map={MAINT_KIND} value={r.kind} /></td>
                <td><Pill map={MAINT_STATE} value={r.state} /></td>
                <td style={{ whiteSpace: "normal", minWidth: 200 }}>{r.description}</td>
                <td>{r.done_by}</td>
                <td className="n num">{money(costOf.get(r.id) ?? r.cost)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
  return (
    <>
      <Alert error={error} ok={ok} />
      <div className="bar">
        <h2>الصيانة</h2>
        <Link className="btn" href="/maintenance/new">+ تسجيل عطل أو صيانة</Link>
      </div>
      <h3 className="sec" style={{ marginTop: 0 }}>الصيانة الدورية</h3>
      {plans?.length ? (
        <div className="tbl">
          <table>
            <thead><tr><th>الماكنة</th><th>الشغلة</th><th>كل</th><th>آخر مرة</th><th>الموعد</th><th></th></tr></thead>
            <tbody>
              {plans.map((p) => {
                const m = p.machine as { code: string; name: string };
                const due = p.next_due <= t;
                const soon = !due && p.next_due <= addDays(t, 7);
                return (
                  <tr key={p.id}>
                    <td>{m.code}. {m.name}</td>
                    <td style={{ whiteSpace: "normal" }}>{p.task}</td>
                    <td className="num">{p.every_days} يوم</td>
                    <td className="num">{p.last_done ?? "—"}</td>
                    <td className={`num ${due ? "tone-bad" : soon ? "tone-warn" : ""}`}>{p.next_due}{due ? " (حان)" : ""}</td>
                    <td>
                      {editPlans && (
                        <div className="row" style={{ gap: 4 }}>
                          <form action={donePlan} className="row" style={{ gap: 4 }}>
                            <input type="hidden" name="id" value={p.id} />
                            <input name="done_by" placeholder="نفذها" aria-label="نفذها" style={{ width: 100 }} />
                            <input name="cost" type="number" step="any" placeholder="الكلفة" aria-label="الكلفة" style={{ width: 90 }} />
                            <button className="btn ghost sm" type="submit">انجزت</button>
                          </form>
                          <form action={deletePlan}>
                            <input type="hidden" name="id" value={p.id} />
                            <button className="btn ghost sm" type="submit" aria-label="حذف الخطة">×</button>
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
      ) : (
        <div className="empty">ما بيه خطط صيانة دورية. ضيف لكل ماكنة شغلاتها: تبديل زيت، تنظيف عدسة، فحص فوهات...</div>
      )}
      {editPlans && (
        <form action={savePlan} className="panel row" style={{ marginTop: 10 }}>
          <select name="machine_id" required aria-label="الماكنة" style={{ width: 180 }} defaultValue="">
            <option value="" disabled>الماكنة</option>
            {[...(machines ?? [])].sort((a, b) => Number(a.code) - Number(b.code)).map((m) => <option key={m.id} value={m.id}>{m.code}. {m.name}</option>)}
          </select>
          <input name="task" required placeholder="الشغلة: تبديل زيت الهيدروليك" aria-label="الشغلة" style={{ flex: "1 1 200px", width: "auto" }} />
          <input name="every_days" type="number" min="1" required placeholder="كل كم يوم" aria-label="كل كم يوم" style={{ width: 110 }} />
          <input name="last_done" type="date" aria-label="آخر مرة انعملت" title="آخر مرة انعملت" style={{ width: 150 }} />
          <button className="btn ghost" type="submit">+ خطة</button>
        </form>
      )}

      <h3 className="sec">مفتوحة</h3>
      {open.length ? table(open) : <div className="empty">لا توجد أعطال مفتوحة.</div>}
      <h3 className="sec">منجزة</h3>
      {done.length ? table(done) : <div className="empty">لا شيء بعد.</div>}
    </>
  );
}
