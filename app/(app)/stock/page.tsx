import Link from "next/link";
import { Alert, Pill, type PageProps } from "@/components/ui";
import { can, getMe } from "@/lib/auth";
import { money, MOVE, num } from "@/lib/labels";
import { supabase } from "@/lib/supabase/server";
import { deleteMove } from "./actions";

export default async function StockPage({ searchParams }: PageProps) {
  const { q, error, ok } = await searchParams;
  const me = await getMe();
  const edit = can.stock(me.role);
  const db = await supabase();
  let mq = db.from("materials").select("*").order("name");
  if (q) mq = mq.or(`name.ilike.%${q}%,spec.ilike.%${q}%,kind.ilike.%${q}%`);
  const [{ data: materials }, { data: moves }] = await Promise.all([
    mq,
    db
      .from("stock_moves")
      .select("id, day, kind, qty, unit_price, note, material:materials(name, unit, currency), order:work_orders(id, no)")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);
  const low = (m: { qty: number; min_qty: number | null }) => m.min_qty !== null && Number(m.qty) <= Number(m.min_qty);
  const sorted = [...(materials ?? [])].sort((a, b) => Number(low(b)) - Number(low(a)));

  return (
    <>
      <Alert error={error} ok={ok} />
      <form className="bar" method="get">
        <h2>المخزن</h2>
        <input name="q" type="search" placeholder="بحث بالاسم أو القياس" defaultValue={q} aria-label="بحث" />
        {edit && (
          <>
            <Link className="btn ghost" href="/stock/move?kind=issue">صرف</Link>
            <Link className="btn ghost" href="/stock/move?kind=receive">استلام</Link>
            <Link className="btn ghost" href="/stock/move?kind=adjust">جرد</Link>
            <Link className="btn" href="/stock/new">+ مادة</Link>
          </>
        )}
      </form>
      {!sorted.length ? (
        <div className="empty">لا توجد مواد مسجلة.{edit && " اضغط «+ مادة» لإضافة أول مادة مع رصيدها الحالي."}</div>
      ) : (
        <div className="tbl">
          <table>
            <thead>
              <tr>
                <th>المادة</th>
                <th>النوع</th>
                <th>القياس</th>
                <th className="n">الرصيد</th>
                <th className="n">حد الطلب</th>
                <th className="n">سعر الوحدة</th>
                <th>المكان</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((m) => (
                <tr key={m.id}>
                  <td>{edit ? <Link href={`/stock/${m.id}`}>{m.name}</Link> : m.name}</td>
                  <td>{m.kind}</td>
                  <td>{[m.grade, m.spec].filter(Boolean).join(" · ")}</td>
                  <td className={`n num ${low(m) ? "neg" : ""}`}>
                    {num(m.qty)} {m.unit} {low(m) && <span className="pill tone-bad">اطلب</span>}
                  </td>
                  <td className="n num">{num(m.min_qty)}</td>
                  <td className="n num">{money(m.unit_price, m.currency)}</td>
                  <td>{m.location}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h3 className="sec">آخر حركات المخزن</h3>
      {!moves?.length ? (
        <div className="empty">كل صرف أو استلام أو جرد يظهر هنا.</div>
      ) : (
        <div className="tbl">
          <table>
            <thead>
              <tr>
                <th>التاريخ</th>
                <th>الحركة</th>
                <th>المادة</th>
                <th className="n">الكمية</th>
                <th>أمر العمل</th>
                <th>ملاحظة</th>
                {edit && <th></th>}
              </tr>
            </thead>
            <tbody>
              {moves.map((mv) => {
                const mat = mv.material as unknown as { name: string; unit: string } | null;
                const order = mv.order as unknown as { id: string; no: number } | null;
                return (
                  <tr key={mv.id}>
                    <td className="num">{mv.day}</td>
                    <td><Pill map={MOVE} value={mv.kind} /></td>
                    <td>{mat?.name}</td>
                    <td className="n num">{num(mv.qty)} {mat?.unit}</td>
                    <td>{order ? <Link href={`/orders/${order.id}`}>#{order.no}</Link> : "—"}</td>
                    <td>{mv.note}</td>
                    {edit && (
                      <td>
                        <form action={deleteMove}>
                          <input type="hidden" name="id" value={mv.id} />
                          <button className="btn ghost sm" type="submit" aria-label="حذف الحركة">×</button>
                        </form>
                      </td>
                    )}
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
