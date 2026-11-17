import { Input, Select, TextArea } from "@/components/ui";
import { CURRENCIES, today } from "@/lib/labels";
import { savePurchase } from "../actions";

export function PurchaseHeadForm({
  r,
  suppliers,
  supplierId,
}: {
  r: Record<string, any> | null;
  suppliers: { id: string; name: string }[];
  supplierId?: string;
}) {
  return (
    <form action={savePurchase} className="panel">
      {r && <input type="hidden" name="id" value={r.id} />}
      <div className="fields">
        <Select name="supplier_id" label="المورد" options={Object.fromEntries(suppliers.map((s) => [s.id, s.name]))} value={r?.supplier_id ?? supplierId} />
        {!r && (
          <>
            <Input name="new_supplier" label="أو مورد جديد: الاسم" />
            <Input name="new_phone" label="هاتف المورد الجديد" type="tel" />
          </>
        )}
        <Input name="supplier_ref" label="رقم فاتورة المورد" value={r?.supplier_ref} />
        <Input name="day" label="التاريخ" type="date" value={r?.day ?? today()} />
        <Input name="due_date" label="موعد التسديد" type="date" value={r?.due_date} />
        <Select name="currency" label="العملة" options={CURRENCIES} value={r?.currency ?? "IQD"} blank={false} />
        <Input name="discount" label="خصم (مبلغ)" type="number" value={r?.discount ?? 0} />
        <TextArea name="notes" label="ملاحظات" value={r?.notes} />
      </div>
      <div className="actions"><button className="btn" type="submit">{r ? "حفظ" : "التالي: البنود"}</button></div>
    </form>
  );
}
