import Link from "next/link";
import { Checks, Input, Select, TextArea } from "@/components/ui";
import { CURRENCIES, JOBS } from "@/lib/labels";
import { saveWorker } from "./actions";

export function WorkerForm({
  w,
  wage,
  machines,
  editInfo,
  editWage,
}: {
  w: Record<string, any> | null;
  wage: Record<string, any> | null;
  machines: { id: string; code: string; name: string }[];
  editInfo: boolean;
  editWage: boolean;
}) {
  return (
    <form action={saveWorker} className="panel">
      {w && <input type="hidden" name="id" value={w.id} />}
      {!editInfo && <input type="hidden" name="full_name" value={w?.full_name ?? ""} />}
      <div className="fields">
        {editInfo && (
          <>
            <Input name="full_name" label="الاسم" value={w?.full_name} required />
            <Select name="job" label="العمل" options={JOBS} value={w?.job} />
            <Input name="phone" label="الهاتف" value={w?.phone} type="tel" />
            <Select name="active" label="الحالة" options={{ yes: "فعّال", no: "ترك العمل" }} value={w && !w.active ? "no" : "yes"} blank={false} />
            <Checks name="skills" label="يجيد تشغيل" items={machines.map((m) => ({ id: m.id, label: `${m.code}. ${m.name}` }))} selected={w?.skills ?? []} />
            <TextArea name="notes" label="ملاحظات" value={w?.notes} />
          </>
        )}
        {editWage && (
          <>
            <Input name="daily_wage" label="الأجر اليومي" value={wage?.daily_wage} type="number" />
            <Select name="currency" label="العملة" options={CURRENCIES} value={wage?.currency ?? "IQD"} blank={false} />
          </>
        )}
      </div>
      <div className="actions">
        <button className="btn" type="submit">حفظ</button>
        <Link className="btn ghost" href="/workers">إلغاء</Link>
      </div>
    </form>
  );
}
