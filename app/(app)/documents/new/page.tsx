import { Alert, type PageProps } from "@/components/ui";
import { can, requireRole } from "@/lib/auth";
import { supabase } from "@/lib/supabase/server";
import { DocForm } from "../doc-form";

export default async function NewDocumentPage({ searchParams }: PageProps) {
  await requireRole(can.docs);
  const sp = await searchParams;
  const db = await supabase();
  const [{ data: orders }, { data: replyTo }] = await Promise.all([
    db.from("work_orders").select("id, no, product").order("no", { ascending: false }).limit(300),
    sp.reply_to
      ? db.from("documents").select("id, ref_no, subject, party").eq("id", sp.reply_to).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const defaults = {
    kind: sp.kind,
    party: replyTo?.party ?? undefined,
    subject: replyTo ? `رد على: ${replyTo.subject}` : undefined,
    status: replyTo ? "done" : undefined,
  };
  return (
    <>
      <div className="bar"><h2>{replyTo ? "كتاب رد" : "مستند جديد"}</h2></div>
      <Alert error={sp.error} />
      <DocForm d={null} orders={orders ?? []} defaults={defaults} replyTo={replyTo} />
    </>
  );
}
