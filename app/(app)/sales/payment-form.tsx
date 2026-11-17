import { Input, Select } from "@/components/ui";
import { CURRENCIES, PAY_METHOD, today } from "@/lib/labels";
import { savePayment } from "./actions";

export function PaymentForm({
  back,
  customerId,
  customers,
  invoices,
  invoiceId,
  currency = "IQD",
  amount,
}: {
  back: string;
  customerId?: string;
  customers?: { id: string; name: string }[];
  invoices?: { id: string; label: string }[];
  invoiceId?: string;
  currency?: string;
  amount?: number;
}) {
  return (
    <form action={savePayment} className="panel">
      <input type="hidden" name="back" value={back} />
      {customerId && <input type="hidden" name="customer_id" value={customerId} />}
      {invoiceId && <input type="hidden" name="invoice_id" value={invoiceId} />}
      <div className="fields">
        {!customerId && customers && (
          <Select name="customer_id" label="الزبون" options={Object.fromEntries(customers.map((c) => [c.id, c.name]))} />
        )}
        {!invoiceId && invoices && invoices.length > 0 && (
          <Select name="invoice_id" label="على فاتورة (اختياري)" options={Object.fromEntries(invoices.map((i) => [i.id, i.label]))} />
        )}
        <Input name="amount" label="المبلغ" type="number" value={amount && amount > 0 ? amount : null} required />
        <Select name="currency" label="العملة" options={CURRENCIES} value={currency} blank={false} />
        <Select name="method" label="طريقة الدفع" options={PAY_METHOD} value="cash" blank={false} />
        <Input name="day" label="التاريخ" type="date" value={today()} />
        <Input name="note" label="ملاحظة (رقم الصك أو الحوالة)" full />
      </div>
      <div className="actions"><button className="btn" type="submit">تسجيل القبض</button></div>
    </form>
  );
}
