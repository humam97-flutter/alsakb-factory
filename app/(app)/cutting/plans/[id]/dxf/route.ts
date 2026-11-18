import { planDxf } from "@/lib/dxf";
import type { Geom } from "@/lib/dxf-import";
import type { Placed, Rect } from "@/lib/nesting";
import { supabase } from "@/lib/supabase/server";

// تنزيل مخطط القص كملف DXF للـ CNC
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await supabase();
  const { data: c } = await db.from("cut_plans").select("layout, remnants, order:work_orders(no), plate:plates(serial, grade, thickness, length_mm, width_mm)").eq("id", id).maybeSingle();
  if (!c) return new Response("not found", { status: 404 });
  const p = c.plate as unknown as { serial: number; grade: string; thickness: number; length_mm: number; width_mm: number };
  const o = c.order as unknown as { no: number };
  const placed = c.layout as Placed[];
  const { data: shapes } = await db.from("cut_parts").select("id, geometry").in("id", [...new Set(placed.map((x) => x.part_id))]).not("geometry", "is", null);
  const geoms = Object.fromEntries((shapes ?? []).map((x) => [x.id, x.geometry as Geom]));
  const withRemnants = new URL(req.url).searchParams.get("remnants") === "1";
  const { dxf } = planDxf(Number(p.length_mm), Number(p.width_mm), placed, c.remnants as Rect[], { title: `WO ${o.no} plate ${p.serial} ${p.grade} t${Number(p.thickness)}`, withRemnants, geoms });
  const name = `WO${o.no}-plate${p.serial}-${String(p.grade).replace(/[^A-Za-z0-9]+/g, "")}-t${Number(p.thickness)}.dxf`;
  return new Response(dxf, { headers: { "Content-Type": "application/dxf", "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "no-store" } });
}
