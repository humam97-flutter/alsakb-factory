import { CURRENCIES } from "@/lib/labels";
import { PROJECT_STATUS } from "@/lib/projects";

type P = { id?: string; name?: string; customer_id?: string | null; contract_no?: string | null; contract_value?: number; currency?: string; start_date?: string | null; end_date?: string | null; status?: string; retention_pct?: number; advance_pct?: number; manager?: string | null; notes?: string | null };

// حقول المشروع (للإضافة والتعديل)
export function ProjectFields({ p, customers }: { p: P; customers: { id: string; name: string }[] }) {
  return (
    <div className="fields">
      {p.id && <input type="hidden" name="id" value={p.id} />}
      <label className="full">اسم المشروع<input name="name" required defaultValue={p.name ?? ""} placeholder="خزانات مصفى الشعيبة" /></label>
      <label>الزبون
        <select name="customer_id" defaultValue={p.customer_id ?? ""}>
          <option value="">-</option>
          {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </label>
      <label>رقم العقد<input name="contract_no" defaultValue={p.contract_no ?? ""} /></label>
      <label>قيمة العقد<input name="contract_value" type="number" step="any" defaultValue={p.contract_value ?? ""} required /></label>
      <label>العملة<select name="currency" defaultValue={p.currency ?? "IQD"}>{Object.entries(CURRENCIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
      <label>تاريخ البدء<input name="start_date" type="date" defaultValue={p.start_date ?? ""} /></label>
      <label>تاريخ الإنجاز<input name="end_date" type="date" defaultValue={p.end_date ?? ""} /></label>
      <label>المحتجز %<input name="retention_pct" type="number" step="any" defaultValue={p.retention_pct ?? 5} /></label>
      <label>استرداد السلفة من كل دفعة %<input name="advance_pct" type="number" step="any" defaultValue={p.advance_pct ?? 0} /></label>
      <label>مدير المشروع<input name="manager" defaultValue={p.manager ?? ""} /></label>
      {p.id && <label>الحالة<select name="status" defaultValue={p.status ?? "active"}>{Object.entries(PROJECT_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></label>}
      <label className="full">ملاحظات<input name="notes" defaultValue={p.notes ?? ""} /></label>
    </div>
  );
}
