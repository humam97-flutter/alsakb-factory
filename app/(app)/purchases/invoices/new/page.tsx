import { Alert, type PageProps } from "@/components/ui";
import { can, requireRole } from "@/lib/auth";
import { supabase } from "@/lib/supabase/server";
import { PurchaseHeadForm } from "../head-form";

export default async function NewPurchasePage({ searchParams }: PageProps) {
  await requireRole(can.finance);
  const { error, supplier } = await searchParams;
  const db = await supabase();
  const { data: suppliers } = await db.from("suppliers").select("id, name").eq("active", true).order("name");
  return (
    <>
      <div className="bar"><h2>فاتورة شراء جديدة</h2></div>
      <Alert error={error} />
      <PurchaseHeadForm r={null} suppliers={suppliers ?? []} supplierId={supplier} />
    </>
  );
}
