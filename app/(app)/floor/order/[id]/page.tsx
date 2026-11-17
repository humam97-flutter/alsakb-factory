import { notFound } from "next/navigation";
import { Alert, type IdPageProps } from "@/components/ui";
import { can, getMe } from "@/lib/auth";
import { num, today } from "@/lib/labels";
import { centerColor, weightProgress } from "@/lib/planning";
import { supabase } from "@/lib/supabase/server";
import { FloorCard } from "../../card";

// يفتح من QR ورقة الشغل: مراحل الأمر بأزرار كبيرة
export default async function FloorOrderPage({ params, searchParams }: IdPageProps) {
  const { id } = await params;
  const sp = await searchParams;
  const me = await getMe();
  const db = await supabase();
  const [{ data: o }, { data: stages }, { data: centers }] = await Promise.all([
    db.from("work_orders").select("id, no, product, client, due_date, weight_kg").eq("id", id).maybeSingle(),
    db.from("work_order_stages").select("id, name, status, progress, plan_start, plan_end, work_center_id, weight_pct").eq("order_id", id).order("position"),
    db.from("work_centers").select("id, name, color"),
  ]);
  if (!o) notFound();
  const cmap = new Map((centers ?? []).map((c) => [c.id, c]));
  const prog = weightProgress(stages ?? []);
  const t = today();
  return (
    <>
      <Alert error={sp.error} ok={sp.ok} />
      <div className="bar"><h2>#{o.no} · {o.product}</h2>{o.due_date ? <span className="meta num">التسليم {o.due_date}</span> : null}</div>
      <div className="panel fc-prog" style={{ marginBottom: 12, fontSize: 18 }}>
        <span>الإنجاز</span><div className="prog" style={{ flex: 1, height: 12 }}><i style={{ width: `${prog}%` }} /></div><b className="num">{prog}%</b>
        {o.weight_kg ? <span className="meta num">{num(Math.round((Number(o.weight_kg) * prog) / 100))} من {num(Number(o.weight_kg))} كغم</span> : null}
      </div>
      <div className="floor-grid">
        {(stages ?? []).map((s) => (
          <FloorCard key={s.id} back={`/floor/order/${id}`} today={t} canEdit={can.stages(me.role)}
            s={{ ...s, center: cmap.get(s.work_center_id ?? "")?.name, color: centerColor(cmap.get(s.work_center_id ?? "")?.color), order: null }} />
        ))}
      </div>
    </>
  );
}
