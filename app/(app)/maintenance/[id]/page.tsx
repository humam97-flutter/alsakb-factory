import { notFound } from "next/navigation";
import { Alert, type IdPageProps } from "@/components/ui";
import { can, requireRole } from "@/lib/auth";
import { supabase } from "@/lib/supabase/server";
import { MaintForm } from "../maint-form";

export default async function EditMaintPage({ params, searchParams }: IdPageProps) {
  await requireRole(can.production);
  const { id } = await params;
  const { error } = await searchParams;
  const db = await supabase();
  const [{ data: r }, { data: machines }] = await Promise.all([
    db.from("maintenance").select("*").eq("id", id).maybeSingle(),
    db.from("machines").select("id, code, name"),
  ]);
  if (!r) notFound();
  return (
    <>
      <div className="bar"><h2>تعديل صيانة</h2></div>
      <Alert error={error} />
      <MaintForm r={r} machines={(machines ?? []).sort((a, b) => Number(a.code) - Number(b.code))} canEditState />
    </>
  );
}
