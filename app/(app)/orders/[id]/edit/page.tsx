import { notFound } from "next/navigation";
import { Alert, type IdPageProps } from "@/components/ui";
import { can, requireRole } from "@/lib/auth";
import { supabase } from "@/lib/supabase/server";
import { deleteOrder } from "../../actions";
import { OrderForm } from "../../order-form";

export default async function EditOrderPage({ params, searchParams }: IdPageProps) {
  const me = await requireRole(can.production);
  const { id } = await params;
  const { error } = await searchParams;
  const db = await supabase();
  const [{ data: order }, { data: finance }, { data: workers }, { data: machines }] = await Promise.all([
    db.from("work_orders").select("*").eq("id", id).maybeSingle(),
    db.from("work_order_finance").select("*").eq("order_id", id).maybeSingle(),
    db.from("workers").select("id, full_name").eq("active", true).order("full_name"),
    db.from("machines").select("id, code, name").order("code"),
  ]);
  if (!order) notFound();
  return (
    <>
      <div className="bar">
        <h2>تعديل أمر #{order.no}</h2>
      </div>
      <Alert error={error} />
      <OrderForm
        order={order}
        finance={finance}
        showFinance={can.finance(me.role)}
        workers={workers ?? []}
        machines={(machines ?? []).sort((a, b) => Number(a.code) - Number(b.code))}
      />
      <form action={deleteOrder} className="panel row" style={{ marginTop: 16 }}>
        <input type="hidden" name="id" value={order.id} />
        <label className="row" style={{ fontSize: 13 }}>
          <input type="checkbox" name="confirm" value="yes" style={{ width: "auto" }} /> أؤكد حذف هذا الأمر ومراحله
        </label>
        <button className="btn danger" type="submit">
          حذف الأمر
        </button>
      </form>
    </>
  );
}
