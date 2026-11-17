import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert, type IdPageProps } from "@/components/ui";
import { can, requireRole } from "@/lib/auth";
import { ATTENDANCE, today } from "@/lib/labels";
import { supabase } from "@/lib/supabase/server";
import { scanWorker } from "../../actions";

const time = (t: string | null) => (t ? new Date(t).toLocaleTimeString("en-GB", { timeZone: "Asia/Baghdad", hour: "2-digit", minute: "2-digit" }) : "—");

// تفتح من بطاقة العامل (QR). المشرف يضغط زر واحد للدخول أو الخروج
export default async function ScanPage({ params, searchParams }: IdPageProps) {
  await requireRole(can.attendance);
  const { id } = await params;
  const { error, done } = await searchParams;
  const db = await supabase();
  const [{ data: w }, { data: a }] = await Promise.all([
    db.from("workers").select("id, full_name, job").eq("id", id).maybeSingle(),
    db.from("attendance").select("*").eq("worker_id", id).eq("day", today()).maybeSingle(),
  ]);
  if (!w) notFound();
  const next = !a?.check_in ? "تسجيل دخول" : "تسجيل خروج";
  return (
    <div style={{ maxWidth: 420, margin: "0 auto", textAlign: "center" }}>
      <Alert error={error} ok={done === "in" ? `انسجل دخول ${w.full_name}` : done === "out" ? `انسجل خروج ${w.full_name}` : undefined} />
      <div className="panel">
        <h2 style={{ marginTop: 0 }}>{w.full_name}</h2>
        {w.job && <div className="meta" style={{ justifyContent: "center" }}>{w.job}</div>}
        <div className="kpis" style={{ marginTop: 12 }}>
          <div className="kpi"><b className="num">{time(a?.check_in ?? null)}</b><span>دخول</span></div>
          <div className="kpi"><b className="num">{time(a?.check_out ?? null)}</b><span>خروج</span></div>
          <div className="kpi"><b>{a ? ATTENDANCE[a.status]?.label : "—"}</b><span>{a?.overtime_hours ? `إضافي ${a.overtime_hours} ساعة` : "اليوم"}</span></div>
        </div>
        {!a?.check_out && (
          <form action={scanWorker} style={{ marginTop: 16 }}>
            <input type="hidden" name="worker_id" value={w.id} />
            <button className="btn" type="submit" style={{ width: "100%", padding: 16, fontSize: 18 }}>{next}</button>
          </form>
        )}
      </div>
      <p className="meta" style={{ justifyContent: "center" }}><Link href="/workers">الحضور</Link></p>
    </div>
  );
}
