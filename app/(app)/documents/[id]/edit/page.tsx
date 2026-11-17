import { notFound } from "next/navigation";
import { Alert, type IdPageProps } from "@/components/ui";
import { can, requireRole } from "@/lib/auth";
import { supabase } from "@/lib/supabase/server";
import { deleteDocument } from "../../actions";
import { DocForm } from "../../doc-form";

export default async function EditDocumentPage({ params, searchParams }: IdPageProps) {
  await requireRole(can.docs);
  const { id } = await params;
  const { error } = await searchParams;
  const db = await supabase();
  const [{ data: d }, { data: orders }] = await Promise.all([
    db.from("documents").select("*").eq("id", id).maybeSingle(),
    db.from("work_orders").select("id, no, product").order("no", { ascending: false }).limit(300),
  ]);
  if (!d) notFound();
  return (
    <>
      <div className="bar"><h2>تعديل {d.ref_no}</h2></div>
      <Alert error={error} />
      <DocForm d={d} orders={orders ?? []} />
      <form action={deleteDocument} className="panel row" style={{ marginTop: 16 }}>
        <input type="hidden" name="id" value={d.id} />
        <label className="row" style={{ fontSize: 13 }}>
          <input type="checkbox" name="confirm" value="yes" style={{ width: "auto" }} /> أؤكد حذف المستند وكل ملفاته
        </label>
        <button className="btn danger" type="submit">حذف</button>
      </form>
    </>
  );
}
