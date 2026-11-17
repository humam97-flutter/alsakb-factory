import Link from "next/link";
import { Checks, Input, Select, TextArea } from "@/components/ui";
import { CURRENCIES, ORDER_STATUS, PRIORITY, today, UNITS } from "@/lib/labels";
import { saveOrder } from "./actions";

type Order = Record<string, any> | null;

const labels = (m: Record<string, { label: string }>) => Object.fromEntries(Object.entries(m).map(([k, v]) => [k, v.label]));

export function OrderForm({
  order,
  finance,
  showFinance,
  workers,
  machines,
}: {
  order: Order;
  finance: Record<string, any> | null;
  showFinance: boolean;
  workers: { id: string; full_name: string }[];
  machines: { id: string; code: string; name: string }[];
}) {
  return (
    <form action={saveOrder} className="panel">
      {order && <input type="hidden" name="id" value={order.id} />}
      <div className="fields">
        <Input name="product" label="المنتج" value={order?.product} full required />
        <Input name="client" label="الزبون" value={order?.client} />
        <Input name="client_phone" label="هاتف الزبون" value={order?.client_phone} type="tel" />
        <Input name="qty" label="الكمية" value={order?.qty} type="number" />
        <Select name="unit" label="الوحدة" options={UNITS} value={order?.unit} />
        <Select name="status" label="الحالة" options={labels(ORDER_STATUS)} value={order?.status ?? "new"} blank={false} />
        <Select name="priority" label="الأولوية" options={labels(PRIORITY)} value={order?.priority ?? "normal"} blank={false} />
        <Input name="start_date" label="تاريخ البدء" value={order?.start_date ?? today()} type="date" />
        <Input name="due_date" label="موعد التسليم" value={order?.due_date} type="date" />
        <Select
          name="owner_id"
          label="المسؤول"
          options={Object.fromEntries(workers.map((w) => [w.id, w.full_name]))}
          value={order?.owner_id}
          full
        />
        <Checks
          name="machines"
          label="المكائن المستخدمة"
          items={machines.map((m) => ({ id: m.id, label: `${m.code}. ${m.name}` }))}
          selected={order?.machines ?? []}
        />
        {showFinance && (
          <>
            <h3 className="sec full" style={{ margin: "8px 0 0" }}>
              المال (يظهر للمدير والمحاسب فقط)
            </h3>
            <Select name="currency" label="العملة" options={CURRENCIES} value={finance?.currency ?? "IQD"} blank={false} />
            <Input name="price" label="سعر البيع المتفق" value={finance?.price} type="number" />
            <Input name="paid" label="المستلم من الزبون" value={finance?.paid} type="number" />
            <Input name="cost_labor" label="أجور العمال على الأمر" value={finance?.cost_labor} type="number" />
            <Input name="cost_machine" label="كهرباء وتشغيل المكائن" value={finance?.cost_machine} type="number" />
            <Input name="cost_other" label="كلف أخرى: نقل، صبغ، غاز" value={finance?.cost_other} type="number" />
          </>
        )}
        <TextArea name="notes" label="ملاحظات وتعليمات للعمال" value={order?.notes} />
      </div>
      <div className="actions">
        <button className="btn" type="submit">
          حفظ
        </button>
        <Link className="btn ghost" href={order ? `/orders/${order.id}` : "/orders"}>
          إلغاء
        </Link>
      </div>
    </form>
  );
}
