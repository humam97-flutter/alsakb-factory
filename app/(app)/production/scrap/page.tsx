import Link from "next/link";
import { type PageProps } from "@/components/ui";
import { num, today } from "@/lib/labels";
import { supabase } from "@/lib/supabase/server";

// الهدر الشهري: حسب الماكنة، ونسبته من المواد المصروفة بالكغم
export default async function ScrapPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const month = sp.month ?? today().slice(0, 7);
  const first = `${month}-01`;
  const next = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 1)).toISOString().slice(0, 10);
  const db = await supabase();
  const [{ data: rows }, { data: issued }] = await Promise.all([
    db.from("scrap").select("*, machine:machines(code, name), order:work_orders(id, no, product)").gte("day", first).lt("day", next).order("day", { ascending: false }),
    db.from("stock_moves").select("qty, material:materials(unit)").eq("kind", "issue").gte("day", first).lt("day", next),
  ]);
  const total = (rows ?? []).reduce((a, r) => a + Number(r.kg), 0);
  const kgIssued = (issued ?? [])
    .filter((m) => (m.material as unknown as { unit: string } | null)?.unit === "كغم" || (m.material as unknown as { unit: string } | null)?.unit === "طن")
    .reduce((a, m) => a + Number(m.qty) * ((m.material as unknown as { unit: string }).unit === "طن" ? 1000 : 1), 0);
  const byMachine = new Map<string, number>();
  for (const r of rows ?? []) {
    const m = r.machine as { code: string; name: string } | null;
    const k = m ? `${m.code}. ${m.name}` : "بدون ماكنة";
    byMachine.set(k, (byMachine.get(k) ?? 0) + Number(r.kg));
  }
  const top = [...byMachine.entries()].sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...top.map(([, v]) => v));

  return (
    <>
      <form className="bar" method="get">
        <h2>الهدر</h2>
        <input type="month" name="month" defaultValue={month} aria-label="الشهر" style={{ maxWidth: 180 }} />
        <button className="btn ghost sm" type="submit">عرض</button>
      </form>
      <div className="kpis">
        <div className="kpi"><b>{num(total)}</b><span>هدر الشهر (كغم)</span></div>
        {kgIssued > 0 && <div className="kpi"><b>{((total / kgIssued) * 100).toFixed(1)}%</b><span>من الحديد المصروف ({num(kgIssued)} كغم)</span></div>}
      </div>
      <p className="meta">الهدر ينسجل من صفحة كل أمر عمل.</p>
      {top.length > 0 && (
        <div className="panel" style={{ marginTop: 10 }}>
          <b>حسب الماكنة</b>
          <ul style={{ listStyle: "none", padding: 0, margin: "8px 0 0" }}>
            {top.map(([k, v]) => (
              <li key={k} style={{ marginBottom: 6 }}>
                <div className="row between" style={{ fontSize: 13 }}><span>{k}</span><span className="num">{num(v)} كغم</span></div>
                <div style={{ height: 6, background: "var(--chip)", borderRadius: 3 }}>
                  <div style={{ width: `${(v / max) * 100}%`, height: 6, background: "var(--warn)", borderRadius: 3 }} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
      <h3 className="sec">السجل</h3>
      {!rows?.length ? (
        <div className="empty">ما بيه هدر مسجل بهذا الشهر.</div>
      ) : (
        <div className="tbl">
          <table>
            <thead><tr><th>التاريخ</th><th>الأمر</th><th>الماكنة</th><th>السبب</th><th className="n">كغم</th></tr></thead>
            <tbody>
              {rows.map((r) => {
                const o = r.order as { id: string; no: number; product: string } | null;
                const m = r.machine as { code: string; name: string } | null;
                return (
                  <tr key={r.id}>
                    <td className="num">{r.day}</td>
                    <td>{o ? <Link href={`/orders/${o.id}`}>#{o.no} · {o.product}</Link> : "—"}</td>
                    <td>{m ? `${m.code}. ${m.name}` : ""}</td>
                    <td>{r.reason}</td>
                    <td className="n num">{num(r.kg)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
