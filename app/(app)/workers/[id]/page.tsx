import { notFound } from "next/navigation";
import { Alert, type IdPageProps } from "@/components/ui";
import { can, requireRole } from "@/lib/auth";
import { today } from "@/lib/labels";
import { supabase } from "@/lib/supabase/server";
import { markLeave } from "../actions";
import { WorkerForm } from "../worker-form";

export default async function EditWorkerPage({ params, searchParams }: IdPageProps) {
  const me = await requireRole(can.attendance);
  const { id } = await params;
  const { error, ok } = await searchParams;
  const db = await supabase();
  const year = today().slice(0, 4);
  const [{ data: w }, { data: wage }, { data: machines }, { data: leaves }] = await Promise.all([
    db.from("workers").select("*").eq("id", id).maybeSingle(),
    db.from("worker_wages").select("*").eq("worker_id", id).maybeSingle(),
    db.from("machines").select("id, code, name"),
    db.from("attendance").select("day").eq("worker_id", id).eq("status", "leave").gte("day", `${year}-01-01`).order("day"),
  ]);
  if (!w) notFound();
  return (
    <>
      <div className="bar"><h2>{w.full_name}</h2></div>
      <Alert error={error} ok={ok} />
      <WorkerForm
        w={w}
        wage={wage}
        machines={(machines ?? []).sort((a, b) => Number(a.code) - Number(b.code))}
        editInfo={can.production(me.role)}
        editWage={can.finance(me.role)}
      />

      <h3 className="sec">الإجازات {year}</h3>
      <div className="kpis">
        <div className="kpi"><b>{w.leave_days}</b><span>الرصيد السنوي</span></div>
        <div className="kpi"><b>{leaves?.length ?? 0}</b><span>أخذ</span></div>
        <div className="kpi"><b className={w.leave_days - (leaves?.length ?? 0) < 0 ? "tone-bad" : "tone-ok"}>{w.leave_days - (leaves?.length ?? 0)}</b><span>الباقي</span></div>
      </div>
      {leaves && leaves.length > 0 && <p className="meta num">{leaves.map((l) => l.day.slice(5)).join(" · ")}</p>}
      {can.production(me.role) && (
        <form action={markLeave} className="panel row">
          <input type="hidden" name="worker_id" value={w.id} />
          <label className="row" style={{ fontSize: 13 }}>من <input type="date" name="from" required style={{ width: 160 }} /></label>
          <label className="row" style={{ fontSize: 13 }}>إلى <input type="date" name="to" style={{ width: 160 }} /></label>
          <button className="btn ghost" type="submit">تسجيل إجازة</button>
        </form>
      )}
    </>
  );
}
