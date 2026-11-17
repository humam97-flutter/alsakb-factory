import Link from "next/link";
import { Alert, Pill, type PageProps } from "@/components/ui";
import { can, getMe } from "@/lib/auth";
import { num, ORDER_STATUS, PRIORITY, today } from "@/lib/labels";
import { supabase } from "@/lib/supabase/server";

export default async function OrdersPage({ searchParams }: PageProps) {
  const { status, q, error } = await searchParams;
  const me = await getMe();
  const db = await supabase();
  let query = db
    .from("work_orders")
    .select("id, no, client, product, qty, unit, status, priority, due_date, machines, owner:workers(full_name), stages:work_order_stages(status)")
    .order("due_date", { ascending: true, nullsFirst: false })
    .limit(300);
  if (status) query = query.eq("status", status);
  else query = query.not("status", "in", "(delivered,cancelled)");
  if (q) query = query.or(`product.ilike.%${q}%,client.ilike.%${q}%`);
  const { data: orders } = await query;
  const t = today();

  return (
    <>
      <Alert error={error} />
      <form className="bar" method="get">
        <h2>أوامر العمل</h2>
        <input name="q" type="search" placeholder="بحث بالمنتج أو الزبون" defaultValue={q} aria-label="بحث" />
        <select name="status" defaultValue={status ?? ""} aria-label="الحالة">
          <option value="">المفتوحة</option>
          {Object.entries(ORDER_STATUS).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </select>
        <button className="btn ghost" type="submit">
          عرض
        </button>
        {can.production(me.role) && (
          <Link className="btn" href="/orders/new">
            + أمر عمل
          </Link>
        )}
      </form>
      {!orders?.length ? (
        <div className="empty">لا توجد أوامر عمل هنا.{can.production(me.role) && " اضغط «+ أمر عمل» لتسجيل أول أمر."}</div>
      ) : (
        <div className="grid">
          {orders.map((o) => {
            const late = o.due_date && o.due_date < t && !["done", "delivered", "cancelled"].includes(o.status);
            const stages = (o.stages ?? []) as { status: string }[];
            const done = stages.filter((s) => s.status === "done").length;
            const owner = o.owner as unknown as { full_name: string } | null;
            return (
              <Link key={o.id} href={`/orders/${o.id}`} className={`card s-${late ? "bad" : ORDER_STATUS[o.status].tone}`}>
                <div className="row between">
                  <span className="t">
                    #{o.no} · {o.product}
                  </span>
                  <Pill map={ORDER_STATUS} value={o.status} />
                </div>
                <div className="meta">
                  {o.client && <span>الزبون: {o.client}</span>}
                  {o.qty && (
                    <span>
                      <span className="num">{num(o.qty)}</span> {o.unit}
                    </span>
                  )}
                  {o.due_date && (
                    <span>
                      التسليم: <span className="num">{o.due_date}</span> {late && <b className="tone-bad">متأخر</b>}
                    </span>
                  )}
                  {owner && <span>المسؤول: {owner.full_name}</span>}
                  {o.priority !== "normal" && <Pill map={PRIORITY} value={o.priority} />}
                </div>
                {stages.length > 0 && (
                  <div className="meta">
                    المراحل:{" "}
                    <span className="num">
                      {done} / {stages.length}
                    </span>
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
