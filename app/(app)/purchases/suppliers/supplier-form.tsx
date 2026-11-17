import Link from "next/link";
import { Input, Select, TextArea } from "@/components/ui";
import { saveSupplier } from "../actions";

export function SupplierForm({ s }: { s: Record<string, any> | null }) {
  return (
    <form action={saveSupplier} className="panel">
      {s && <input type="hidden" name="id" value={s.id} />}
      <div className="fields">
        <Input name="name" label="الاسم" value={s?.name} required />
        <Input name="phone" label="الهاتف" value={s?.phone} type="tel" />
        <Input name="supplies" label="شنو يجهّز (صاج، أنابيب، أصباغ...)" value={s?.supplies} full />
        <Input name="address" label="العنوان" value={s?.address} full />
        {s && <Select name="active" label="الحالة" options={{ yes: "فعّال", no: "موقوف" }} value={s.active ? "yes" : "no"} blank={false} />}
        <TextArea name="notes" label="ملاحظات" value={s?.notes} />
      </div>
      <div className="actions">
        <button className="btn" type="submit">حفظ</button>
        <Link className="btn ghost" href="/purchases/suppliers">إلغاء</Link>
      </div>
    </form>
  );
}
