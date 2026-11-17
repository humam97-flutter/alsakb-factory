import Link from "next/link";
import { Alert, type PageProps } from "@/components/ui";
import { YieldBar } from "@/components/nest-svg";
import { money, num } from "@/lib/labels";
import { supabase } from "@/lib/supabase/server";

export default async function PlansPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const db = await supabase();
  let q = db
    .from("cut_plans")
    .select("id, status, plate_kg, parts_kg, remnant_kg, scrap_kg, loss_value, created_at, done_at, layout, order:work_orders(id, no, product), plate:plates(serial, grade, thickness, length_mm, width_mm)")
    .order("status")
    .order("created_at", { ascending: false })
    .limit(300);
  if (sp.order) q = q.eq("order_id", sp.order);
  if (sp.status) q = q.eq("status", sp.status);
  const { data } = await q;
  const rows = data ?? [];

  return (
    <>
      <Alert error={sp.error} ok={sp.ok} />
      <form className="bar" method="get">
        <h2>مخططات القص</h2>
        {sp.order && <input type="hidden" name="order" value={sp.order} />}
        <select name="status" defaultValue={sp.status ?? ""} aria-label="الحالة" style={{ width: 150 }}>
          <option value="">الكل</option>
          <option value="draft">تنتظر القص</option>
          <option value="done">منفذة</option>
        </select>
        <button className="btn ghost" type="submit">عرض</button>
        {sp.order && <Link className="btn ghost" href="/cutting/plans">كل الأوامر</Link>}
      </form>
      {!rows.length ? (
        <div className="empty">ما بيه مخططات بعد. افتح أمر العمل، أضف «قطع القص»، واضغط «اقترح مخطط قص».</div>
      ) : (
        <div className="tbl">
          <table>
            <thead>
              <tr><th>الأمر</th><th>اللوح</th><th className="n">القطع</th><th>الاستغلال</th><th className="n">الاستغلال %</th><th className="n">هدر كغم</th><th className="n">الخسارة</th><th>الحالة</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const o = r.order as unknown as { id: string; no: number; product: string };
                const p = r.plate as unknown as { serial: number; grade: string; thickness: number; length_mm: number; width_mm: number };
                const y = Number(r.plate_kg) ? (Number(r.parts_kg) / Number(r.plate_kg)) * 100 : 0;
                return (
                  <tr key={r.id}>
                    <td><Link href={`/cutting/plans/${r.id}`}>#{o?.no} · {o?.product}</Link></td>
                    <td className="num">#{p?.serial} · {p?.grade} {num(p?.thickness)}مم · <bdi className="ltr">{Number(p?.length_mm)}×{Number(p?.width_mm)}</bdi></td>
                    <td className="n num">{(r.layout as unknown[]).length}</td>
                    <td><YieldBar parts={Number(r.parts_kg)} remnant={Number(r.remnant_kg)} scrap={Number(r.scrap_kg)} /></td>
                    <td className={`n num ${y < 70 ? "neg" : ""}`}>{y.toFixed(1)}%</td>
                    <td className="n num">{num(r.scrap_kg)}</td>
                    <td className="n num">{r.status === "done" ? money(r.loss_value) : <span className="meta">متوقع {money(r.loss_value)}</span>}</td>
                    <td>{r.status === "done" ? <span className="pill tone-ok">منفذ</span> : <span className="pill tone-warn">ينتظر القص</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <div className="legend" style={{ marginTop: 10 }}>
        <span><i style={{ background: "var(--primary)" }} />قطع</span>
        <span><i style={{ background: "var(--ok)" }} />بقايا ترجع للمخزن</span>
        <span><i style={{ background: "var(--bad)" }} />هدر</span>
      </div>
    </>
  );
}
