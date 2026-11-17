import Link from "next/link";
import { Alert, Pill, type PageProps } from "@/components/ui";
import { can, getMe } from "@/lib/auth";
import { MAINT_KIND, MAINT_STATE, money } from "@/lib/labels";
import { supabase } from "@/lib/supabase/server";

export default async function MaintenancePage({ searchParams }: PageProps) {
  const { error } = await searchParams;
  const me = await getMe();
  const db = await supabase();
  const { data: rows } = await db
    .from("maintenance")
    .select("*, machine:machines(code, name)")
    .order("day", { ascending: false })
    .limit(200);
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
                <td className="n num">{money(r.cost)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
  return (
    <>
      <Alert error={error} />
      <div className="bar">
        <h2>الصيانة</h2>
        <Link className="btn" href="/maintenance/new">+ تسجيل عطل أو صيانة</Link>
      </div>
      <h3 className="sec" style={{ marginTop: 0 }}>مفتوحة</h3>
      {open.length ? table(open) : <div className="empty">لا توجد أعطال مفتوحة.</div>}
      <h3 className="sec">منجزة</h3>
      {done.length ? table(done) : <div className="empty">لا شيء بعد.</div>}
    </>
  );
}
