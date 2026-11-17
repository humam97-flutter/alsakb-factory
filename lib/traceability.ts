import type { supabase } from "@/lib/supabase/server";

type Db = Awaited<ReturnType<typeof supabase>>;

export type TraceRow = { key: string; part: string; qty: number; grade: string; thickness: number | null; size: string | null; heat_no: string | null; cert_no: string | null; source: string; ref: string; manual: boolean };

// تتبع مواد الأمر: كل قطعة مقصوصة ← اللوح ← رقم الصبة والشهادة، وبعدها المواد المسجلة يدوياً
export async function orderTrace(db: Db, orderId: string) {
  const [{ data: plans }, { data: certs }] = await Promise.all([
    db.from("cut_plans").select("id, layout, done_at, plate:plates(id, serial, grade, thickness, length_mm, width_mm, heat_no, cert_no)").eq("order_id", orderId).eq("status", "done").order("done_at"),
    db.from("material_certs").select("*").eq("order_id", orderId).order("created_at"),
  ]);
  const rows: TraceRow[] = [];
  for (const p of plans ?? []) {
    const plate = p.plate as unknown as { id: string; serial: number; grade: string; thickness: number; length_mm: number; width_mm: number; heat_no: string | null; cert_no: string | null } | null;
    if (!plate) continue;
    const byName = new Map<string, number>();
    for (const it of (p.layout as { name: string }[]) ?? []) byName.set(it.name, (byName.get(it.name) ?? 0) + 1);
    for (const [part, qty] of byName) {
      rows.push({
        key: `${p.id}-${part}`, part, qty, grade: plate.grade, thickness: Number(plate.thickness),
        size: `${Number(plate.length_mm)}×${Number(plate.width_mm)}`,
        heat_no: plate.heat_no, cert_no: plate.cert_no, source: `لوح #${plate.serial}`, ref: plate.id, manual: false,
      });
    }
  }
  for (const c of certs ?? []) {
    rows.push({ key: c.id, part: c.item, qty: Number(c.qty ?? 0), grade: c.grade ?? "", thickness: null, size: c.size, heat_no: c.heat_no, cert_no: c.cert_no, source: c.supplier ?? "يدوي", ref: c.id, manual: true });
  }
  const missing = rows.filter((r) => !r.heat_no).length;
  return { rows, missing };
}
