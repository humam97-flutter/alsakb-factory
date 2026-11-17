import { Alert, type PageProps } from "@/components/ui";
import { supabase } from "@/lib/supabase/server";
import { HeadForm } from "../../head-form";

export default async function NewQuotePage({ searchParams }: PageProps) {
  const { error, customer } = await searchParams;
  const db = await supabase();
  const { data: customers } = await db.from("customers").select("id, name").eq("active", true).order("name");
  return (
    <>
      <div className="bar"><h2>عرض سعر جديد</h2></div>
      <Alert error={error} />
      <HeadForm kind="quote" r={null} customers={customers ?? []} customerId={customer} />
    </>
  );
}
