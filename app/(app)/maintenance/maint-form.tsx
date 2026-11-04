import Link from "next/link";
import { Input, Select, TextArea } from "@/components/ui";
import { MAINT_KIND, MAINT_STATE, today } from "@/lib/labels";
import { saveMaintenance } from "../machines/actions";

const labels = (m: Record<string, { label: string }>) => Object.fromEntries(Object.entries(m).map(([k, v]) => [k, v.label]));

export function MaintForm({
  r,
  machines,
  canEditState,
}: {
  r: Record<string, any> | null;
  machines: { id: string; code: string; name: string }[];
  canEditState: boolean;
}) {
  return (
    <form action={saveMaintenance} className="panel">
      {r && <input type="hidden" name="id" value={r.id} />}
      <div className="fields">
        <Select
          name="machine_id"
          label="الماكنة"
          options={Object.fromEntries(machines.map((m) => [m.id, `${m.code}. ${m.name}`]))}
          value={r?.machine_id}
          full
        />
        <Select name="kind" label="النوع" options={labels(MAINT_KIND)} value={r?.kind ?? "breakdown"} blank={false} />
        {canEditState ? (
          <Select name="state" label="الحالة" options={labels(MAINT_STATE)} value={r?.state ?? "open"} blank={false} />
        ) : (
          <input type="hidden" name="state" value="open" />
        )}
        <Input name="day" label="التاريخ" value={r?.day ?? today()} type="date" />
        <Input name="done_by" label="نفذها" value={r?.done_by} />
        <Input name="cost" label="الكلفة (د.ع)" value={r?.cost} type="number" />
        <TextArea name="description" label="الوصف: شنو العطل أو شنو انعمل" value={r?.description} />
      </div>
      <div className="actions">
        <button className="btn" type="submit">حفظ</button>
        <Link className="btn ghost" href="/maintenance">إلغاء</Link>
      </div>
    </form>
  );
}
