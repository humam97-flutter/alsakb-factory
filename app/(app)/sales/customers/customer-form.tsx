import Link from "next/link";
import { Input, Select, TextArea } from "@/components/ui";
import { saveCustomer } from "../actions";

export function CustomerForm({ c }: { c: Record<string, any> | null }) {
  return (
    <form action={saveCustomer} className="panel">
      {c && <input type="hidden" name="id" value={c.id} />}
      <div className="fields">
        <Input name="name" label="الاسم" value={c?.name} required />
        <Input name="phone" label="الهاتف" value={c?.phone} type="tel" />
        <Input name="address" label="العنوان" value={c?.address} full />
        {c && <Select name="active" label="الحالة" options={{ yes: "فعّال", no: "موقوف" }} value={c.active ? "yes" : "no"} blank={false} />}
        <TextArea name="notes" label="ملاحظات" value={c?.notes} />
      </div>
      <div className="actions">
        <button className="btn" type="submit">حفظ</button>
        <Link className="btn ghost" href="/sales/customers">إلغاء</Link>
      </div>
    </form>
  );
}
