import { Alert, type PageProps } from "@/components/ui";
import { can, getMe } from "@/lib/auth";
import { supabase } from "@/lib/supabase/server";
import { MaintForm } from "../maint-form";

export default async function NewMaintPage({ searchParams }: PageProps) {
  const me = await getMe();
  const { error } = await searchParams;
  const db = await supabase();
  const { data: machines } = await db.from("machines").select("id, code, name");
  return (
    <>
      <div className="bar"><h2>تسجيل عطل أو صيانة</h2></div>
      <Alert error={error} />
      <MaintForm r={null} machines={(machines ?? []).sort((a, b) => Number(a.code) - Number(b.code))} canEditState={can.production(me.role)} />
    </>
  );
}
