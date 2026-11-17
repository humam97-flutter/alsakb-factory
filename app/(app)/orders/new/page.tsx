import { Alert, type PageProps } from "@/components/ui";
import { can, requireRole } from "@/lib/auth";
import { supabase } from "@/lib/supabase/server";
import { OrderForm } from "../order-form";

export default async function NewOrderPage({ searchParams }: PageProps) {
  const me = await requireRole(can.production);
  const { error } = await searchParams;
  const db = await supabase();
  const [{ data: workers }, { data: machines }] = await Promise.all([
    db.from("workers").select("id, full_name").eq("active", true).order("full_name"),
    db.from("machines").select("id, code, name").order("code"),
  ]);
  return (
    <>
      <div className="bar">
        <h2>أمر عمل جديد</h2>
      </div>
      <Alert error={error} />
      <OrderForm
        order={null}
        finance={null}
        showFinance={can.finance(me.role)}
        workers={workers ?? []}
        machines={(machines ?? []).sort((a, b) => Number(a.code) - Number(b.code))}
      />
    </>
  );
}
