import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert, Pill, type IdPageProps } from "@/components/ui";
import { can, getMe } from "@/lib/auth";
import { money, num, ORDER_STATUS, PRIORITY, STAGE_STATUS, today } from "@/lib/labels";
import { supabase } from "@/lib/supabase/server";
import { addStage, deleteStage, setStage } from "../actions";

export default async function OrderPage({ params, searchParams }: IdPageProps) {
  const { id } = await params;
  const { error } = await searchParams;
  const me = await getMe();
  const db = await supabase();
  const [{ data: o }, { data: stages }, { data: moves }, { data: cost }, { data: machines }] = await Promise.all([
    db.from("work_orders").select("*, owner:workers(full_name)").eq("id", id).maybeSingle(),
    db.from("work_order_stages").select("*, machine:machines(name)").eq("order_id", id).order("position"),
    db.from("stock_moves").select("id, day, qty, unit_price, material:materials(name, unit, currency)").eq("order_id", id).eq("kind", "issue").order("day"),
    db.from("work_order_costs").select("*").eq("order_id", id).maybeSingle(),
    db.from("machines").select("id, code, name"),
  ]);
  if (!o) notFound();
  const mName = new Map((machines ?? []).map((m) => [m.id, m.name]));
  const late = o.due_date && o.due_date < today() && !["done", "delivered", "cancelled"].includes(o.status);
  const owner = o.owner as { full_name: string } | null;
  const cur = cost?.currency ?? "IQD";
  const profit = cost?.price != null ? Number(cost.price) - Number(cost.cost_total) : null;

  const info: [string, React.ReactNode][] = [
    ["الزبون", o.client],
    ["هاتف الزبون", o.client_phone],
    ["الكمية", o.qty ? `${num(o.qty)} ${o.unit ?? ""}` : null],
    ["تاريخ البدء", o.start_date],
    ["موعد التسليم", o.due_date],
    ["الأولوية", <Pill key="p" map={PRIORITY} value={o.priority} />],
    ["المسؤول", owner?.full_name],
    ["المكائن", (o.machines as string[]).map((m) => mName.get(m)).filter(Boolean).join("، ")],
  ];

  return (
    <>
      <Alert error={error} />
      <div className="bar">
        <h2>
          أمر عمل #{o.no} · {o.product}
        </h2>
        <Pill map={ORDER_STATUS} value={o.status} />
        {late && <span className="pill tone-bad">متأخر</span>}
      </div>
      <div className="actions noprint" style={{ marginTop: 0, marginBottom: 14 }}>
        {can.production(me.role) && (
          <Link className="btn" href={`/orders/${o.id}/edit`}>
            تعديل
          </Link>
        )}
        {can.stock(me.role) && (
          <Link className="btn ghost" href={`/stock/move?kind=issue&order=${o.id}`}>
            صرف مواد لهذا الأمر
          </Link>
        )}
        <Link className="btn ghost" href={`/orders/${o.id}/print`}>
          ورقة الشغل للطباعة
        </Link>
      </div>

      <div className="panel kv">
        {info
          .filter(([, v]) => v)
          .map(([l, v]) => (
            <div key={l}>
              <span>{l}</span>
              <b style={{ fontWeight: 500 }}>{v}</b>
            </div>
          ))}
      </div>
      {o.notes && (
        <div className="panel" style={{ marginTop: 10, whiteSpace: "pre-wrap" }}>
          {o.notes}
        </div>
      )}

      <h3 className="sec">مراحل العمل</h3>
      <div className="panel">
        <ol className="stages">
          {(stages ?? []).map((s) => (
            <li key={s.id}>
              <span className="name">
                {s.position}. {s.name}
                {s.machine && <span className="meta"> · {(s.machine as { name: string }).name}</span>}
              </span>
              {s.done_at && <span className="meta num">{new Date(s.done_at).toLocaleDateString("en-CA")}</span>}
              {can.stages(me.role) ? (
                <form action={setStage} className="seg" role="group" aria-label={`حالة ${s.name}`}>
                  <input type="hidden" name="order_id" value={o.id} />
                  <input type="hidden" name="stage_id" value={s.id} />
                  {Object.entries(STAGE_STATUS).map(([k, v]) => (
                    <button key={k} type="submit" name="status" value={k} className={`tone-${v.tone}`} aria-pressed={s.status === k}>
                      {v.label}
                    </button>
                  ))}
                </form>
              ) : (
                <Pill map={STAGE_STATUS} value={s.status} />
              )}
              {can.production(me.role) && (
                <form action={deleteStage}>
                  <input type="hidden" name="order_id" value={o.id} />
                  <input type="hidden" name="stage_id" value={s.id} />
                  <button className="btn ghost sm" type="submit" aria-label={`حذف مرحلة ${s.name}`}>
                    ×
                  </button>
                </form>
              )}
            </li>
          ))}
        </ol>
        {can.production(me.role) && (
          <form action={addStage} className="row" style={{ marginTop: 10 }}>
            <input type="hidden" name="order_id" value={o.id} />
            <input name="name" placeholder="مرحلة إضافية، مثلاً: خراطة" style={{ flex: "1 1 180px", width: "auto" }} aria-label="اسم المرحلة" />
            <select name="machine_id" style={{ flex: "1 1 160px", width: "auto" }} aria-label="الماكنة">
              <option value="">بدون ماكنة</option>
              {(machines ?? []).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            <button className="btn ghost" type="submit">
              إضافة مرحلة
            </button>
          </form>
        )}
      </div>

      <h3 className="sec">المواد المصروفة</h3>
      {moves?.length ? (
        <div className="tbl">
          <table>
            <thead>
              <tr>
                <th>التاريخ</th>
                <th>المادة</th>
                <th className="n">الكمية</th>
                <th className="n">القيمة</th>
              </tr>
            </thead>
            <tbody>
              {moves.map((m) => {
                const mat = m.material as unknown as { name: string; unit: string; currency: string };
                return (
                  <tr key={m.id}>
                    <td className="num">{m.day}</td>
                    <td>{mat?.name}</td>
                    <td className="n num">
                      {num(m.qty)} {mat?.unit}
                    </td>
                    <td className="n num">{money(Number(m.qty) * Number(m.unit_price), mat?.currency)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty">لم تُصرف مواد على هذا الأمر بعد. أمين المخزن يسجل الصرف من صفحة المخزن.</div>
      )}

      {can.finance(me.role) && (
        <>
          <h3 className="sec">الكلفة والربح</h3>
          {cost ? (
            <div className="tbl">
              <table>
                <tbody>
                  <tr><td>مواد مصروفة من المخزن</td><td className="n num">{money(cost.cost_material, cur)}</td></tr>
                  <tr><td>أجور العمال</td><td className="n num">{money(cost.cost_labor, cur)}</td></tr>
                  <tr><td>كهرباء وتشغيل المكائن</td><td className="n num">{money(cost.cost_machine, cur)}</td></tr>
                  <tr><td>كلف أخرى</td><td className="n num">{money(cost.cost_other, cur)}</td></tr>
                  <tr><td><b>مجموع الكلفة</b></td><td className="n num"><b>{money(cost.cost_total, cur)}</b></td></tr>
                  <tr><td>سعر البيع</td><td className="n num">{money(cost.price, cur)}</td></tr>
                  {profit !== null && (
                    <>
                      <tr>
                        <td><b>الربح</b></td>
                        <td className={`n num ${profit < 0 ? "neg" : "pos"}`}>
                          <b>{money(profit, cur)}</b>
                          {Number(cost.price) > 0 && ` (${Math.round((profit / Number(cost.price)) * 100)}%)`}
                        </td>
                      </tr>
                      <tr><td>المستلم من الزبون</td><td className="n num">{money(cost.paid, cur)}</td></tr>
                      <tr>
                        <td>الباقي على الزبون</td>
                        <td className="n num neg">{money(Number(cost.price) - Number(cost.paid), cur)}</td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty">لم يُسجل سعر أو كلف لهذا الأمر. أضفها من «تعديل».</div>
          )}
          <p className="meta">ملاحظة: قيمة المواد بعملة كل مادة؛ إذا خلطت دينار ودولار على نفس الأمر، وحّد العملة بسعر المادة.</p>
        </>
      )}
    </>
  );
}
