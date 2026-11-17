import { Input, Select, TextArea } from "@/components/ui";
import { CURRENCIES, today } from "@/lib/labels";
import { saveInvoice, saveQuote } from "./actions";

// رأس عرض السعر أو الفاتورة: الزبون، التاريخ، العملة، الخصم
export function HeadForm({
  kind,
  r,
  customers,
  customerId,
  orders,
}: {
  kind: "quote" | "invoice";
  r: Record<string, any> | null;
  customers: { id: string; name: string }[];
  customerId?: string;
  orders?: { id: string; label: string }[];
}) {
  return (
    <form action={kind === "quote" ? saveQuote : saveInvoice} className="panel">
      {r && <input type="hidden" name="id" value={r.id} />}
      <div className="fields">
        <Select
          name="customer_id"
          label="الزبون"
          options={Object.fromEntries(customers.map((c) => [c.id, c.name]))}
          value={r?.customer_id ?? customerId}
        />
        {!r && (
          <>
            <Input name="new_customer" label="أو زبون جديد: الاسم" />
            <Input name="new_phone" label="هاتف الزبون الجديد" type="tel" />
          </>
        )}
        <Input name="day" label="التاريخ" type="date" value={r?.day ?? today()} />
        {kind === "quote" ? (
          <Input name="valid_until" label="العرض صالح لغاية" type="date" value={r?.valid_until} />
        ) : (
          <Input name="due_date" label="موعد الدفع" type="date" value={r?.due_date} />
        )}
        <Select name="currency" label="العملة" options={CURRENCIES} value={r?.currency ?? "IQD"} blank={false} />
        <Input name="discount" label="خصم (مبلغ)" type="number" value={r?.discount ?? 0} />
        {kind === "invoice" && orders && (
          <Select name="order_id" label="أمر العمل" options={Object.fromEntries(orders.map((o) => [o.id, o.label]))} value={r?.order_id} />
        )}
        {kind === "invoice" && r && (
          <Select name="cancelled" label="الحالة" options={{ no: "فعّالة", yes: "ملغاة" }} value={r.cancelled ? "yes" : "no"} blank={false} />
        )}
        <TextArea name="notes" label={kind === "quote" ? "شروط وملاحظات (مدة التنفيذ، الدفع، النقل)" : "ملاحظات"} value={r?.notes} />
      </div>
      <div className="actions"><button className="btn" type="submit">{r ? "حفظ" : "التالي: البنود"}</button></div>
    </form>
  );
}
