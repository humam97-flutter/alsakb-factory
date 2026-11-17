import { Alert, type PageProps } from "@/components/ui";
import { can, requireRole } from "@/lib/auth";
import { supabase } from "@/lib/supabase/server";
import { WorkerForm } from "../worker-form";

export default async function NewWorkerPage({ searchParams }: PageProps) {
  const me = await requireRole(can.production);
  const { error } = await searchParams;
  const db = await supabase();
  const { data: machines } = await db.from("machines").select("id, code, name");
  return (
    <>
      <div className="bar"><h2>عامل جديد</h2></div>
      <Alert error={error} />
      <WorkerForm
        w={null}
        wage={null}
        machines={(machines ?? []).sort((a, b) => Number(a.code) - Number(b.code))}
        editInfo
        editWage={can.finance(me.role)}
      />
    </>
  );
}
