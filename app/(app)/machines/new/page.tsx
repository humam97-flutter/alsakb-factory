import { Alert, type PageProps } from "@/components/ui";
import { can, requireRole } from "@/lib/auth";
import { supabase } from "@/lib/supabase/server";
import { MachineForm } from "../machine-form";

export default async function NewMachinePage({ searchParams }: PageProps) {
  await requireRole(can.production);
  const { error } = await searchParams;
  const db = await supabase();
  const { data: workers } = await db.from("workers").select("id, full_name").eq("active", true).order("full_name");
  return (
    <>
      <div className="bar"><h2>ماكنة جديدة</h2></div>
      <Alert error={error} />
      <MachineForm m={null} workers={workers ?? []} />
    </>
  );
}
