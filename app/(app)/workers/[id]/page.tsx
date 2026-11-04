import { notFound } from "next/navigation";
import { Alert, type IdPageProps } from "@/components/ui";
import { can, requireRole } from "@/lib/auth";
import { supabase } from "@/lib/supabase/server";
import { WorkerForm } from "../worker-form";

export default async function EditWorkerPage({ params, searchParams }: IdPageProps) {
  const me = await requireRole(can.attendance);
  const { id } = await params;
  const { error } = await searchParams;
  const db = await supabase();
  const [{ data: w }, { data: wage }, { data: machines }] = await Promise.all([
    db.from("workers").select("*").eq("id", id).maybeSingle(),
    db.from("worker_wages").select("*").eq("worker_id", id).maybeSingle(),
    db.from("machines").select("id, code, name"),
  ]);
  if (!w) notFound();
  return (
    <>
      <div className="bar"><h2>{w.full_name}</h2></div>
      <Alert error={error} />
      <WorkerForm
        w={w}
        wage={wage}
        machines={(machines ?? []).sort((a, b) => Number(a.code) - Number(b.code))}
        editInfo={can.production(me.role)}
        editWage={can.finance(me.role)}
      />
    </>
  );
}
