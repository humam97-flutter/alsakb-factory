import { notFound } from "next/navigation";
import { Alert, type IdPageProps } from "@/components/ui";
import { can, requireRole } from "@/lib/auth";
import { money, num } from "@/lib/labels";
import { supabase } from "@/lib/supabase/server";
import { issuePart } from "../../production/actions";
import { MaintForm } from "../maint-form";

export default async function EditMaintPage({ params, searchParams }: IdPageProps) {
  await requireRole(can.production);
  const { id } = await params;
  const { error } = await searchParams;
  const db = await supabase();
  const [{ data: r }, { data: machines }, { data: parts }, { data: materials }] = await Promise.all([
    db.from("maintenance").select("*").eq("id", id).maybeSingle(),
    db.from("machines").select("id, code, name"),
    db.from("stock_moves").select("id, day, qty, unit_price, material:materials(name, unit)").eq("maintenance_id", id).order("day"),
    db.from("materials").select("id, name, spec, qty, unit, kind").gt("qty", 0).order("name"),
  ]);
  const partsCost = (parts ?? []).reduce((a, p) => a + Number(p.qty) * Number(p.unit_price), 0);
  if (!r) notFound();
  return (
    <>
      <div className="bar"><h2>تعديل صيانة</h2></div>
      <Alert error={error} />
      <MaintForm r={r} machines={(machines ?? []).sort((a, b) => Number(a.code) - Number(b.code))} canEditState />

      <h3 className="sec">قطع الغيار المصروفة {partsCost > 0 && <span className="meta">({money(partsCost)})</span>}</h3>
      <div className="panel">
        {parts?.length ? (
          <ul className="stages">
            {parts.map((p) => {
              const m = p.material as unknown as { name: string; unit: string };
              return (
                <li key={p.id}>
                  <span className="num meta">{p.day}</span>
                  <span className="name">{m.name}: {num(p.qty)} {m.unit}</span>
                  <span className="num">{money(Number(p.qty) * Number(p.unit_price))}</span>
                </li>
              );
            })}
          </ul>
        ) : null}
        <form action={issuePart} className="row" style={{ marginTop: parts?.length ? 10 : 0 }}>
          <input type="hidden" name="maintenance_id" value={r.id} />
          <select name="material_id" required defaultValue="" aria-label="القطعة" style={{ flex: "1 1 220px", width: "auto" }}>
            <option value="" disabled>اختر قطعة من المخزن</option>
            {[...(materials ?? [])].sort((a, b) => Number(b.kind === "قطع غيار") - Number(a.kind === "قطع غيار")).map((m) => (
              <option key={m.id} value={m.id}>{m.name}{m.spec ? ` · ${m.spec}` : ""} (باقي {num(m.qty)} {m.unit})</option>
            ))}
          </select>
          <input name="qty" type="number" step="any" min="0" required placeholder="الكمية" aria-label="الكمية" style={{ width: 100 }} />
          <button className="btn ghost" type="submit">صرف للصيانة</button>
        </form>
        <p className="meta" style={{ marginBottom: 0 }}>القطعة تنسحب من المخزن وكلفتها تنضاف لكلفة الصيانة.</p>
      </div>
    </>
  );
}
