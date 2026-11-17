import { Alert, Input, Pill, Select, type PageProps } from "@/components/ui";
import { can, getMe } from "@/lib/auth";
import { num, REQUEST_STATUS, UNITS } from "@/lib/labels";
import { supabase } from "@/lib/supabase/server";
import { deleteRequest, saveRequest, setRequestStatus } from "../actions";

export default async function RequestsPage({ searchParams }: PageProps) {
  const { error, ok, all } = await searchParams;
  const me = await getMe();
  const approve = can.finance(me.role);
  const db = await supabase();
  let q = db
    .from("purchase_requests")
    .select("*, material:materials(name, qty, unit), supplier:suppliers(name)")
    .order("created_at", { ascending: false })
    .limit(200);
  if (!all) q = q.in("status", ["pending", "approved"]);
  const [{ data: requests }, { data: materials }, { data: suppliers }, { data: people }] = await Promise.all([
    q,
    db.from("materials").select("id, name, spec, qty, min_qty, unit").order("name"),
    db.from("suppliers").select("id, name").eq("active", true).order("name"),
    db.from("profiles").select("id, full_name"),
  ]);
  const who = new Map((people ?? []).map((p) => [p.id, p.full_name]));
  const open = new Set((requests ?? []).filter((r) => r.status === "pending" || r.status === "approved").map((r) => r.material_id));
  const low = (materials ?? []).filter((m) => m.min_qty !== null && Number(m.qty) <= Number(m.min_qty) && !open.has(m.id));

  return (
    <>
      <Alert error={error} ok={ok} />
      <div className="bar">
        <h2>طلبات الشراء</h2>
        <a className="btn ghost sm" href={all ? "/purchases/requests" : "/purchases/requests?all=1"}>{all ? "المفتوحة بس" : "عرض الكل"}</a>
      </div>

      {low.length > 0 && (
        <div className="panel" style={{ marginBottom: 12 }}>
          <b className="tone-bad">مواد تحت حد الطلب وما إلها طلب</b>
          <ul className="stages" style={{ marginTop: 6 }}>
            {low.map((m) => (
              <li key={m.id}>
                <span className="name">{m.name}{m.spec ? ` · ${m.spec}` : ""} <span className="meta">باقي {num(m.qty)} {m.unit}</span></span>
                <form action={saveRequest} className="row">
                  <input type="hidden" name="material_id" value={m.id} />
                  <input type="hidden" name="unit" value={m.unit} />
                  <input name="qty" type="number" step="any" placeholder="الكمية" aria-label={`كمية ${m.name}`} style={{ width: 110 }} required />
                  <button className="btn ghost sm" type="submit">اطلب</button>
                </form>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!requests?.length ? (
        <div className="empty">ما بيه طلبات {all ? "" : "مفتوحة"}.</div>
      ) : (
        <div className="tbl">
          <table>
            <thead><tr><th>التاريخ</th><th>المطلوب</th><th className="n">الكمية</th><th>قبل</th><th>المورد</th><th>طلبه</th><th>الحالة</th><th></th></tr></thead>
            <tbody>
              {requests.map((r) => {
                const mine = r.created_by === me.id && r.status === "pending";
                return (
                  <tr key={r.id}>
                    <td className="num">{r.created_at.slice(0, 10)}</td>
                    <td style={{ whiteSpace: "normal", minWidth: 180 }}>
                      {r.description}
                      {r.note && <div className="meta">{r.note}</div>}
                    </td>
                    <td className="n num">{r.qty ? `${num(r.qty)} ${r.unit ?? ""}` : ""}</td>
                    <td className="num">{r.needed_by}</td>
                    <td>{(r.supplier as { name: string } | null)?.name}</td>
                    <td>{who.get(r.created_by)}</td>
                    <td>
                      {approve ? (
                        <form action={setRequestStatus} className="seg" role="group" aria-label="الحالة">
                          <input type="hidden" name="id" value={r.id} />
                          {Object.entries(REQUEST_STATUS).map(([k, v]) => (
                            <button key={k} type="submit" name="status" value={k} className={`tone-${v.tone}`} aria-pressed={r.status === k}>{v.label}</button>
                          ))}
                        </form>
                      ) : (
                        <Pill map={REQUEST_STATUS} value={r.status} />
                      )}
                    </td>
                    <td>
                      {(mine || me.role === "manager") && (
                        <form action={deleteRequest}>
                          <input type="hidden" name="id" value={r.id} />
                          <button className="btn ghost sm" type="submit" aria-label="حذف الطلب">×</button>
                        </form>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <h3 className="sec">طلب جديد</h3>
      <form action={saveRequest} className="panel">
        <div className="fields">
          <Select
            name="material_id"
            label="مادة من المخزن"
            options={Object.fromEntries((materials ?? []).map((m) => [m.id, `${m.name}${m.spec ? " · " + m.spec : ""} (باقي ${num(m.qty)} ${m.unit})`]))}
            full
          />
          <Input name="description" label="أو اكتب شنو تحتاج (غير موجود بالمخزن)" full />
          <Input name="qty" label="الكمية" type="number" />
          <Select name="unit" label="الوحدة" options={UNITS} />
          <Input name="needed_by" label="نحتاجه قبل" type="date" />
          <Select name="supplier_id" label="مورد مقترح" options={Object.fromEntries((suppliers ?? []).map((s) => [s.id, s.name]))} />
          <Input name="note" label="ملاحظة (لأي أمر عمل، مواصفات...)" full />
        </div>
        <div className="actions"><button className="btn" type="submit">رفع الطلب</button></div>
      </form>
    </>
  );
}
