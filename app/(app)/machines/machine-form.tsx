import Link from "next/link";
import { Input, Select, TextArea } from "@/components/ui";
import { MACHINE_STATUS } from "@/lib/labels";
import { saveMachine } from "./actions";

export function MachineForm({ m, workers }: { m: Record<string, any> | null; workers: { id: string; full_name: string }[] }) {
  return (
    <form action={saveMachine} className="panel">
      {m && <input type="hidden" name="id" value={m.id} />}
      <div className="fields">
        <Input name="code" label="الرقم" value={m?.code} required />
        <Input name="name" label="اسم الماكنة" value={m?.name} required />
        <Input name="capacity" label="القياس / القدرة" value={m?.capacity} />
        <Select
          name="status"
          label="الحالة"
          options={Object.fromEntries(Object.entries(MACHINE_STATUS).map(([k, v]) => [k, v.label]))}
          value={m?.status ?? "running"}
          blank={false}
        />
        <Select name="operator_id" label="المشغل" options={Object.fromEntries(workers.map((w) => [w.id, w.full_name]))} value={m?.operator_id} />
        <Input name="next_service" label="الصيانة القادمة" value={m?.next_service} type="date" />
        <TextArea name="notes" label="ملاحظات" value={m?.notes} />
      </div>
      <div className="actions">
        <button className="btn" type="submit">حفظ</button>
        <Link className="btn ghost" href="/machines">إلغاء</Link>
      </div>
    </form>
  );
}
