import Link from "next/link";
import { Input, Select, TextArea } from "@/components/ui";
import { CURRENCIES, MATERIAL_KINDS, UNITS } from "@/lib/labels";
import { saveMaterial } from "./actions";

export function MaterialForm({ m }: { m: Record<string, any> | null }) {
  return (
    <form action={saveMaterial} className="panel">
      {m && <input type="hidden" name="id" value={m.id} />}
      <div className="fields">
        <Input name="name" label="المادة" value={m?.name} full required />
        <Select name="kind" label="النوع" options={MATERIAL_KINDS} value={m?.kind} />
        <Input name="grade" label="الرتبة (مثل ST37)" value={m?.grade} />
        <Input name="spec" label="السمك / القياس" value={m?.spec} />
        <Select name="unit" label="الوحدة" options={UNITS} value={m?.unit ?? "قطعة"} blank={false} />
        {!m && <Input name="opening_qty" label="الرصيد الحالي" type="number" />}
        <Input name="min_qty" label="حد الطلب (أقل كمية)" value={m?.min_qty} type="number" />
        <Input name="unit_price" label="سعر الوحدة" value={m?.unit_price} type="number" />
        <Select name="currency" label="العملة" options={CURRENCIES} value={m?.currency ?? "IQD"} blank={false} />
        <Input name="location" label="مكان الخزن" value={m?.location} />
        <TextArea name="notes" label="ملاحظات" value={m?.notes} />
      </div>
      {m && <p className="meta">الرصيد الحالي: {m.qty} {m.unit}. لتغييره سجّل حركة صرف أو استلام أو جرد.</p>}
      <div className="actions">
        <button className="btn" type="submit">حفظ</button>
        <Link className="btn ghost" href="/stock">إلغاء</Link>
      </div>
    </form>
  );
}
