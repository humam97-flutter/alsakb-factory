import Link from "next/link";
import { Alert, type PageProps } from "@/components/ui";
import { can, getMe } from "@/lib/auth";
import { today } from "@/lib/labels";
import { addDays, centerColor } from "@/lib/planning";
import { supabase } from "@/lib/supabase/server";
import { FloorCard, type FloorStage } from "./card";

// شاشة الورشة: شنو المطلوب من كل مركز عمل اليوم، بأزرار كبيرة للتابلت
export default async function FloorPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const me = await getMe();
  const t = today();
  const db = await supabase();
  const [{ data: centers }, { data: stages }] = await Promise.all([
    db.from("work_centers").select("id, name, color").eq("active", true).order("position"),
    db.from("work_order_stages").select("id, name, status, progress, plan_start, plan_end, work_center_id, order:work_orders!inner(id, no, product, client, status)").neq("status", "done").in("order.status", ["new", "in_progress"]).order("plan_start", { nullsFirst: false }),
  ]);
  const cs = centers ?? [];
  const wc = sp.wc && cs.some((c) => c.id === sp.wc) ? sp.wc : null;
  const cmap = new Map(cs.map((c) => [c.id, c]));
  const soon = addDays(t, 7);
  const list = (stages ?? [])
    .filter((s) => (wc ? s.work_center_id === wc : true))
    .filter((s) => s.status === "working" || (s.plan_start && s.plan_start <= soon))
    .sort((a, b) => (a.status === "working" ? 0 : 1) - (b.status === "working" ? 0 : 1) || String(a.plan_start).localeCompare(String(b.plan_start)))
    .map((s) => ({ ...s, center: cmap.get(s.work_center_id ?? "")?.name, color: centerColor(cmap.get(s.work_center_id ?? "")?.color), order: s.order as unknown as FloorStage["order"] })) as FloorStage[];
  const back = wc ? `/floor?wc=${wc}` : "/floor";
  return (
    <>
      <Alert error={sp.error} ok={sp.ok} />
      <div className="bar"><h2>شاشة الورشة</h2><span className="meta num">{t}</span></div>
      <nav className="checks floor-tabs" aria-label="مراكز العمل">
        <Link href="/floor" className={!wc ? "on" : ""}>الكل</Link>
        {cs.map((c) => <Link key={c.id} href={`/floor?wc=${c.id}`} className={wc === c.id ? "on" : ""} style={{ ["--c" as string]: centerColor(c.color) }}>{c.name}</Link>)}
      </nav>
      {list.length ? (
        <div className="floor-grid">{list.map((s) => <FloorCard key={s.id} s={s} back={back} today={t} canEdit={can.stages(me.role)} />)}</div>
      ) : <div className="empty">ما اكو شغل مخطط لهذا المركز خلال الأسبوع.</div>}
      <p className="meta">تظهر المراحل الشغالة، واللي مخطط تبدي خلال 7 أيام. صوّر QR ورقة الأمر حتى تفتح مراحله مباشرة.</p>
    </>
  );
}
