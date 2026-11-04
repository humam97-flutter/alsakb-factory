import { notFound } from "next/navigation";
import { Alert, type IdPageProps } from "@/components/ui";
import { can, requireRole } from "@/lib/auth";
import { supabase } from "@/lib/supabase/server";
import { deleteMaterial } from "../actions";
import { MaterialForm } from "../material-form";

export default async function EditMaterialPage({ params, searchParams }: IdPageProps) {
  await requireRole(can.stock);
  const { id } = await params;
  const { error } = await searchParams;
  const db = await supabase();
  const { data: m } = await db.from("materials").select("*").eq("id", id).maybeSingle();
  if (!m) notFound();
  return (
    <>
      <div className="bar"><h2>{m.name}</h2></div>
      <Alert error={error} />
      <MaterialForm m={m} />
      <form action={deleteMaterial} className="panel row" style={{ marginTop: 16 }}>
        <input type="hidden" name="id" value={m.id} />
        <label className="row" style={{ fontSize: 13 }}>
          <input type="checkbox" name="confirm" value="yes" style={{ width: "auto" }} /> أؤكد حذف المادة
        </label>
        <button className="btn danger" type="submit">حذف</button>
      </form>
    </>
  );
}
