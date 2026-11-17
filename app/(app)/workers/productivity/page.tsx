import Link from "next/link";
import { type PageProps } from "@/components/ui";
import { can, requireRole } from "@/lib/auth";
import { num, today } from "@/lib/labels";
import { supabase } from "@/lib/supabase/server";

// إنتاجية العمال: المراحل المنجزة وساعاتها، والحضور والهدر بالشهر
export default async function ProductivityPage({ searchParams }: PageProps) {
  await requireRole(can.attendance);
  const sp = await searchParams;
  const month = sp.month ?? today().slice(0, 7);
  const first = `${month}-01`;
  const next = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 1)).toISOString().slice(0, 10);
  const db = await supabase();
  const [{ data: workers }, { data: prod }, { data: att }] = await Promise.all([
    db.from("workers").select("id, full_name, job").eq("active", true).order("full_name"),
    db.from("worker_productivity").select("*").eq("month", first),
    db.from("attendance").select("worker_id, status, overtime_hours").gte("day", first).lt("day", next),
  ]);
  const p = new Map((prod ?? []).map((x) => [x.worker_id, x]));
  const days = new Map<string, { d: number; ot: number }>();
  for (const a of att ?? []) {
    const x = days.get(a.worker_id) ?? { d: 0, ot: 0 };
    x.d += a.status === "present" ? 1 : a.status === "half" ? 0.5 : 0;
    x.ot += Number(a.overtime_hours);
    days.set(a.worker_id, x);
  }
  const rows = (workers ?? [])
    .map((w) => ({ ...w, s: Number(p.get(w.id)?.stages_done ?? 0), h: Number(p.get(w.id)?.hours ?? 0), o: Number(p.get(w.id)?.orders ?? 0), d: days.get(w.id)?.d ?? 0, ot: days.get(w.id)?.ot ?? 0 }))
    .sort((a, b) => b.s - a.s);
  const max = Math.max(1, ...rows.map((r) => r.s));

  return (
    <>
      <form className="bar" method="get">
        <h2>إنتاجية العمال</h2>
        <input type="month" name="month" defaultValue={month} aria-label="الشهر" style={{ maxWidth: 180 }} />
        <button className="btn ghost sm" type="submit">عرض</button>
        <Link className="btn ghost sm" href="/workers">الحضور</Link>
      </form>
      <p className="meta">تنحسب من المراحل اللي انكتب منفذها بصفحة أمر العمل وانعلمت منجزة.</p>
      <div className="tbl">
        <table>
          <thead><tr><th>العامل</th><th>المراحل المنجزة</th><th className="n">أوامر</th><th className="n">ساعات تشغيل</th><th className="n">أيام حضور</th><th className="n">إضافي</th><th className="n">مرحلة لكل يوم</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td><Link href={`/workers/${r.id}`}>{r.full_name}</Link>{r.job && <div className="meta">{r.job}</div>}</td>
                <td style={{ minWidth: 140 }}>
                  <div className="row" style={{ flexWrap: "nowrap" }}>
                    <span className="num" style={{ width: 28 }}>{r.s}</span>
                    <div style={{ flex: 1, height: 6, background: "var(--chip)", borderRadius: 3 }}>
                      <div style={{ width: `${(r.s / max) * 100}%`, height: 6, background: "var(--info)", borderRadius: 3 }} />
                    </div>
                  </div>
                </td>
                <td className="n num">{r.o || "—"}</td>
                <td className="n num">{r.h ? num(r.h) : "—"}</td>
                <td className="n num">{num(r.d)}</td>
                <td className="n num">{r.ot ? num(r.ot) : "—"}</td>
                <td className="n num">{r.d ? (r.s / r.d).toFixed(1) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
