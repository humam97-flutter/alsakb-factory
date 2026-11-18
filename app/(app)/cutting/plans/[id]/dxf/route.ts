import { planDxf } from "@/lib/dxf";
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
  const withRemnants = new URL(req.url).searchParams.get("remnants") === "1";
  const { dxf } = planDxf(Number(p.length_mm), Number(p.width_mm), c.layout as Placed[], c.remnants as Rect[], { title: `WO ${o.no} plate ${p.serial} ${p.grade} t${Number(p.thickness)}`, withRemnants });
  const name = `WO${o.no}-plate${p.serial}-${String(p.grade).replace(/[^A-Za-z0-9]+/g, "")}-t${Number(p.thickness)}.dxf`;
  return new Response(dxf, { headers: { "Content-Type": "application/dxf", "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "no-store" } });
}
