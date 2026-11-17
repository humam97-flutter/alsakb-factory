import { Input, Select } from "@/components/ui";
import { CURRENCIES, PAY_METHOD, today } from "@/lib/labels";
import { saveSupplierPayment } from "./actions";

export function SupplierPayForm({
  back,
  supplierId,
  suppliers,
  invoices,
  invoiceId,
  currency = "IQD",
  amount,
}: {
  back: string;
  supplierId?: string;
  suppliers?: { id: string; name: string }[];
  invoices?: { id: string; label: string }[];
  invoiceId?: string;
  currency?: string;
  amount?: number;
}) {
  return (
    <form action={saveSupplierPayment} className="panel">
      <input type="hidden" name="back" value={back} />
      {supplierId && <input type="hidden" name="supplier_id" value={supplierId} />}
      {invoiceId && <input type="hidden" name="invoice_id" value={invoiceId} />}
      <div className="fields">
        {!supplierId && suppliers && (
          <Select name="supplier_id" label="المورد" options={Object.fromEntries(suppliers.map((s) => [s.id, s.name]))} />
        )}
        {!invoiceId && invoices && invoices.length > 0 && (
          <Select name="invoice_id" label="على فاتورة (اختياري)" options={Object.fromEntries(invoices.map((i) => [i.id, i.label]))} />
        )}
        <Input name="amount" label="المبلغ" type="number" value={amount && amount > 0 ? amount : null} required />
        <Select name="currency" label="العملة" options={CURRENCIES} value={currency} blank={false} />
        <Select name="method" label="طريقة الدفع" options={PAY_METHOD} value="cash" blank={false} />
        <Input name="day" label="التاريخ" type="date" value={today()} />
        <Input name="note" label="ملاحظة" full />
      </div>
      <div className="actions"><button className="btn" type="submit">تسجيل التسديد</button></div>
    </form>
  );
}
