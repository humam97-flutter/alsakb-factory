import Link from "next/link";
import { YieldBar } from "@/components/nest-svg";
import { can, type Role } from "@/lib/auth";
import { GRADES, SHAPE_LABEL } from "@/lib/cutting";
import { money, num } from "@/lib/labels";
import { countPlaced, kgOf, partArea } from "@/lib/nesting";
import { supabase } from "@/lib/supabase/server";
import { deletePart, savePart } from "../../cutting/actions";

// قطع الصاج المطلوبة للأمر، ومخططات قصها
export async function OrderCutting({ orderId, role }: { orderId: string; role: Role }) {
  const db = await supabase();
  const [{ data: parts }, { data: plans }] = await Promise.all([
    db.from("cut_parts").select("*").eq("order_id", orderId).order("created_at"),
    db.from("cut_plans").select("id, status, layout, plate_kg, parts_kg, remnant_kg, scrap_kg, loss_value, plate:plates(serial, grade, thickness, length_mm, width_mm)").eq("order_id", orderId).order("created_at"),
  ]);
  const edit = can.production(role);
  const done = countPlaced((plans ?? []).filter((p) => p.status === "done"));
  const planned = countPlaced((plans ?? []).filter((p) => p.status === "draft"));
  const ps = parts ?? [];
  const totalKg = ps.reduce((a, p) => a + kgOf(partArea(p), Number(p.thickness), 7.85) * p.qty, 0);
  const size = (p: (typeof ps)[number]) =>
    p.shape === "rect" ? `${num(p.length_mm)} × ${num(p.width_mm)}` : p.shape === "ring" ? `Ø${num(p.diameter_mm)} / Ø${num(p.inner_mm)}` : `Ø${num(p.diameter_mm)}`;
  const doneLoss = (plans ?? []).filter((p) => p.status === "done").reduce((a, p) => a + Number(p.loss_value), 0);

  return (
    <>
      <h3 className="sec" id="cutting">
        قطع القص من الألواح {ps.length > 0 && <span className="meta">({num(Math.round(totalKg))} كغم صافي)</span>}
      </h3>
      <div className="panel">
        {ps.length ? (
          <div className="tbl" style={{ boxShadow: "none", margin: "0 0 10px" }}>
            <table data-plain>
              <thead><tr><th>القطعة</th><th>الشكل</th><th>النوع</th><th className="n">السمك</th><th className="n">القياس (ملم)</th><th className="n">العدد</th><th className="n">انقص / بمخطط</th><th></th></tr></thead>
              <tbody>
                {ps.map((p) => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td>{SHAPE_LABEL[p.shape]}</td>
                    <td>{p.grade}</td>
                    <td className="n num">{num(p.thickness)}</td>
                    <td className="n num"><bdi className="ltr">{size(p)}</bdi></td>
                    <td className="n num">{p.qty}</td>
                    <td className="n num">{done.get(p.id) ?? 0} / {planned.get(p.id) ?? 0}</td>
                    <td>
                      {edit && !done.get(p.id) && (
                        <form action={deletePart}>
                          <input type="hidden" name="id" value={p.id} />
                          <input type="hidden" name="order_id" value={orderId} />
                          <button className="btn ghost sm" type="submit" aria-label="حذف">×</button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="meta" style={{ marginTop: 0 }}>سجل قطع الصاج (جسم الخزان، رؤوس، فلنجات، قواعد...) والبرنامج يرتبها على الألواح ويحسب الهدر.</p>
        )}
        {edit && (
          <form action={savePart} className="row">
            <input type="hidden" name="order_id" value={orderId} />
            <input name="name" placeholder="اسم القطعة: Shell" aria-label="اسم القطعة" style={{ flex: "1 1 140px", width: "auto" }} required />
            <select name="shape" defaultValue="rect" aria-label="الشكل" style={{ width: 130 }}>
              {Object.entries(SHAPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <input name="grade" list="cut-grades" defaultValue="A36" aria-label="النوع" style={{ width: 110 }} />
            <datalist id="cut-grades">{GRADES.map((g) => <option key={g} value={g} />)}</datalist>
            <input name="thickness" type="number" step="any" min="0" placeholder="السمك" aria-label="السمك ملم" style={{ width: 80 }} required />
            <input name="a" type="number" step="any" min="0" placeholder="الطول أو القطر" aria-label="الطول أو القطر الخارجي ملم" style={{ width: 120 }} required />
            <input name="b" type="number" step="any" min="0" placeholder="العرض أو الفتحة" aria-label="العرض أو قطر الفتحة ملم" style={{ width: 120 }} />
            <input name="qty" type="number" min="1" defaultValue={1} aria-label="العدد" style={{ width: 70 }} />
            <button className="btn ghost" type="submit">إضافة قطعة</button>
          </form>
        )}
        {ps.length > 0 && (
          <div className="row" style={{ marginTop: 10 }}>
            <Link className="btn" href={`/cutting/order/${orderId}`}>اقترح مخطط قص</Link>
            {(plans?.length ?? 0) > 0 && <Link className="btn ghost" href={`/cutting/plans?order=${orderId}`}>المخططات ({plans!.length})</Link>}
            {doneLoss > 0 && <span className="meta">خسارة الهدر لحد الآن: {money(doneLoss)}</span>}
          </div>
        )}
        {(plans?.length ?? 0) > 0 && (
          <ul className="stages" style={{ marginTop: 10 }}>
            {plans!.map((c) => {
              const p = c.plate as unknown as { serial: number; grade: string; thickness: number; length_mm: number; width_mm: number };
              const y = Number(c.plate_kg) ? (Number(c.parts_kg) / Number(c.plate_kg)) * 100 : 0;
              return (
                <li key={c.id}>
                  <Link className="name" href={`/cutting/plans/${c.id}`}>لوح #{p.serial} · {p.grade} {num(p.thickness)}مم · <bdi className="ltr">{Number(p.length_mm)}×{Number(p.width_mm)}</bdi></Link>
                  <YieldBar parts={Number(c.parts_kg)} remnant={Number(c.remnant_kg)} scrap={Number(c.scrap_kg)} />
                  <span className="num meta">{y.toFixed(0)}%</span>
                  {c.status === "done" ? <span className="pill tone-ok">انقص</span> : <span className="pill tone-warn">ينتظر القص</span>}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
