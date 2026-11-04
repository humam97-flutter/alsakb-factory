import Link from "next/link";
import { Alert, type PageProps } from "@/components/ui";
import { can, requireRole } from "@/lib/auth";
import { ATTENDANCE, today } from "@/lib/labels";
import { supabase } from "@/lib/supabase/server";
import { markAttendance, setOvertime } from "./actions";

export default async function WorkersPage({ searchParams }: PageProps) {
  const me = await requireRole(can.attendance);
  const sp = await searchParams;
  const day = sp.day ?? today();
  const edit = can.production(me.role);
  const db = await supabase();
  const [{ data: workers }, { data: att }] = await Promise.all([
    db.from("workers").select("id, full_name, job, phone, active").order("full_name"),
    db.from("attendance").select("worker_id, status, overtime_hours").eq("day", day),
  ]);
  const marks = new Map((att ?? []).map((a) => [a.worker_id, a]));
  const activeW = (workers ?? []).filter((w) => w.active);
  const count = (s: string) => activeW.filter((w) => marks.get(w.id)?.status === s).length;

  return (
    <>
      <Alert error={sp.error} />
      <form className="bar" method="get">
        <h2>الحضور</h2>
        <input type="date" name="day" defaultValue={day} aria-label="اليوم" style={{ maxWidth: 180 }} />
        <button className="btn ghost sm" type="submit">عرض</button>
        <span className="meta">
          حاضر <b className="num">{count("present")}</b> · نصف يوم <b className="num">{count("half")}</b> · غائب <b className="num">{count("absent")}</b> · لم يُسجل{" "}
          <b className="num">{activeW.length - activeW.filter((w) => marks.has(w.id)).length}</b>
        </span>
      </form>
      {edit && activeW.length > 0 && (
        <form action={markAttendance} style={{ marginBottom: 10 }}>
          <input type="hidden" name="day" value={day} />
          <input type="hidden" name="status" value="present" />
          <button className="btn ghost sm" type="submit">الكل حاضر (لمن لم يُسجل)</button>
        </form>
      )}
      {activeW.length === 0 ? (
        <div className="empty">لا يوجد عمال. {edit && "أضف العمال أولاً."}</div>
      ) : (
        <div className="tbl">
          <table>
            <thead><tr><th>العامل</th><th>الحضور</th><th>ساعات إضافية</th></tr></thead>
            <tbody>
              {activeW.map((w) => {
                const a = marks.get(w.id);
                return (
                  <tr key={w.id}>
                    <td>{w.full_name}</td>
                    <td>
                      {edit ? (
                        <form action={markAttendance} className="seg" role="group" aria-label={`حضور ${w.full_name}`}>
                          <input type="hidden" name="day" value={day} />
                          <input type="hidden" name="worker_id" value={w.id} />
                          {Object.entries(ATTENDANCE).map(([k, v]) => (
                            <button key={k} type="submit" name="status" value={k} className={`tone-${v.tone}`} aria-pressed={a?.status === k}>
                              {v.label}
                            </button>
                          ))}
                        </form>
                      ) : (
                        (a && ATTENDANCE[a.status].label) || "—"
                      )}
                    </td>
                    <td>
                      {edit && a ? (
                        <form action={setOvertime} className="row" style={{ flexWrap: "nowrap" }}>
                          <input type="hidden" name="day" value={day} />
                          <input type="hidden" name="worker_id" value={w.id} />
                          <input name="overtime_hours" type="number" step="0.5" min="0" defaultValue={a.overtime_hours || ""} style={{ width: 80 }} aria-label="ساعات إضافية" />
                          <button className="btn ghost sm" type="submit">حفظ</button>
                        </form>
                      ) : (
                        a?.overtime_hours || "—"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="bar" style={{ marginTop: 26 }}>
        <h2>العمال</h2>
        {edit && <Link className="btn" href="/workers/new">+ عامل</Link>}
      </div>
      <div className="grid">
        {(workers ?? []).map((w) => (
          <Link key={w.id} href={`/workers/${w.id}`} className={`card s-${w.active ? "ok" : "mut"}`}>
            <div className="row between">
              <span className="t">{w.full_name}</span>
              {!w.active && <span className="pill tone-mut">غير فعّال</span>}
            </div>
            <div className="meta">
              {w.job && <span>{w.job}</span>}
              {w.phone && <span className="num">{w.phone}</span>}
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
