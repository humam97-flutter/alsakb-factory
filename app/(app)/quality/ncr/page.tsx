import Link from "next/link";
import { Alert, type PageProps } from "@/components/ui";
import { can, getMe } from "@/lib/auth";
import { money, today } from "@/lib/labels";
import { NCR_SOURCE } from "@/lib/quality";
import { supabase } from "@/lib/supabase/server";
import { saveNcr } from "../actions";

export default async function NcrPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const me = await getMe();
  const edit = can.production(me.role);
  const db = await supabase();
  const status = sp.status ?? "open";
  let q = db.from("ncrs").select("*, order:work_orders(id, no, product)").order("no", { ascending: false }).limit(300);
  if (status !== "all") q = q.eq("status", status);
  const [{ data }, { data: orders }] = await Promise.all([
    q,
    db.from("work_orders").select("id, no, product").order("no", { ascending: false }).limit(200),
  ]);
  const rows = data ?? [];
  const cost = rows.reduce((a, r) => a + Number(r.cost), 0);
  return (
    <>
      <Alert error={sp.error} ok={sp.ok} />
      <form className="bar" method="get">
        <h2>عدم المطابقة (NCR)</h2>
        <select name="status" defaultValue={status} aria-label="الحالة" style={{ width: 130 }}>
          <option value="open">مفتوحة</option>
          <option value="closed">مغلقة</option>
          <option value="all">الكل</option>
        </select>
        <button className="btn ghost" type="submit">عرض</button>
        {cost > 0 && <span className="meta">كلفة التصليحات: <b className="num">{money(cost)}</b></span>}
      </form>
      {!rows.length ? (
        <div className="empty">{status === "open" ? "ما بيه حالات مفتوحة." : "ما بيه حالات."}</div>
      ) : (
        <div className="tbl">
          <table>
            <thead><tr><th>الرقم</th><th>التاريخ</th><th>الأمر</th><th>المصدر</th><th>المشكلة</th><th>السبب والإجراء</th><th className="n">الكلفة</th><th>الحالة</th></tr></thead>
            <tbody>
              {rows.map((r) => {
                const o = r.order as { id: string; no: number; product: string } | null;
                return (
                  <tr key={r.id}>
                    <td className="num">NCR-{r.no}</td>
                    <td className="num">{r.day}</td>
                    <td>{o ? <Link href={`/orders/${o.id}/qa`}>#{o.no}</Link> : ""}</td>
                    <td>{NCR_SOURCE[r.source]}</td>
                    <td>{r.description}</td>
                    <td className="meta">{[r.cause, r.action].filter(Boolean).join(" ← ")}</td>
                    <td className="n num">{Number(r.cost) ? money(r.cost) : ""}</td>
                    <td>
                      {r.status === "open" && edit ? (
                        <form action={saveNcr} className="row" style={{ gap: 4 }}>
                          {Object.entries({ id: r.id, order_id: r.order_id ?? "", day: r.day, source: r.source, description: r.description, cause: r.cause ?? "", cost: r.cost, status: "closed", back: "/quality/ncr" }).map(([k, v]) => <input key={k} type="hidden" name={k} value={String(v)} />)}
                          <input name="action" defaultValue={r.action ?? ""} placeholder="الإجراء المتخذ" aria-label="الإجراء" style={{ width: 160 }} />
                          <button className="btn ghost sm" type="submit">إغلاق</button>
                        </form>
                      ) : r.status === "open" ? <span className="pill tone-bad">مفتوحة</span> : <span className="pill tone-ok">مغلقة {r.closed_on}</span>}
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
          <h3 className="sec">تسجيل حالة عدم مطابقة</h3>
          <form action={saveNcr} className="panel">
            <input type="hidden" name="back" value="/quality/ncr" />
            <div className="fields">
              <label>
                أمر العمل
                <select name="order_id" defaultValue="">
                  <option value="">بدون</option>
                  {(orders ?? []).map((o) => <option key={o.id} value={o.id}>#{o.no} · {o.product}</option>)}
                </select>
              </label>
              <label>التاريخ<input name="day" type="date" defaultValue={today()} /></label>
              <label>
                المصدر
                <select name="source" defaultValue="internal">{Object.entries(NCR_SOURCE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
              </label>
              <label>كلفة التصليح (دينار)<input name="cost" type="number" step="any" /></label>
              <label className="full">المشكلة<textarea name="description" rows={2} required placeholder="مثلاً: مسامية باللحامة C2 طلعت بالأشعة" /></label>
              <label className="full">السبب<input name="cause" /></label>
              <label className="full">الإجراء التصحيحي<input name="action" /></label>
            </div>
            <div className="actions"><button className="btn" type="submit">تسجيل</button></div>
          </form>
        </>
      )}
    </>
  );
}
