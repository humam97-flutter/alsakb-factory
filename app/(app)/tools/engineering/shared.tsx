import { num } from "@/lib/labels";
import { supabase } from "@/lib/supabase/server";
import { saveCalc } from "./actions";

type SP = Record<string, string | undefined>;

// قراءة المدخلات الرقمية من الرابط مع قيم افتراضية
export function read<T extends Record<string, number | string>>(sp: SP, def: T): T {
  const out: Record<string, number | string> = {};
  for (const [k, v] of Object.entries(def)) {
    const raw = sp[k];
    if (raw === undefined || raw === "") out[k] = v;
    else out[k] = typeof v === "number" ? (Number.isFinite(Number(raw)) ? Number(raw) : v) : raw;
  }
  return out as T;
}

export function N({ name, label, v, step = "any", hint }: { name: string; label: string; v: number | string; step?: string; hint?: string }) {
  return (
    <label>
      {label}
      <input name={name} type="number" step={step} inputMode="decimal" defaultValue={v} />
      {hint && <small className="meta">{hint}</small>}
    </label>
  );
}

export function Sel({ name, label, v, options }: { name: string; label: string; v: string; options: Record<string, string> }) {
  return (
    <label>
      {label}
      <select name={name} defaultValue={v}>
        {Object.entries(options).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
      </select>
    </label>
  );
}

// سطر نتيجة: عنوان، قيمة، ملاحظة
export function Out({ rows }: { rows: [string, React.ReactNode, React.ReactNode?][] }) {
  return (
    <div className="tbl">
      <table data-plain>
        <tbody>
          {rows.map(([l, v, n], i) => (
            <tr key={i}>
              <td>{l}</td>
              <td className="n num" style={{ whiteSpace: "nowrap" }}><bdi className="ltr">{v}</bdi></td>
              <td className="meta">{n}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const f = (x: number, d = 1) => num(Math.round(x * 10 ** d) / 10 ** d);
export const bar = (mpa: number) => `${f(mpa * 10, 2)} bar`;

// حفظ الحساب وربطه بأمر، واختيارياً إضافة قطعه لقائمة القص
export async function SaveBox({ kind, inputs, title, parts }: { kind: string; inputs: Record<string, unknown>; title: string; parts: boolean }) {
  const db = await supabase();
  const { data: orders } = await db.from("work_orders").select("id, no, product").in("status", ["new", "in_progress", "on_hold"]).order("no", { ascending: false }).limit(200);
  return (
    <form action={saveCalc} className="panel noprint" style={{ marginTop: 14 }}>
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="inputs" value={JSON.stringify(inputs)} />
      <b>حفظ الحساب</b>
      <div className="row" style={{ marginTop: 8 }}>
        <input name="title" defaultValue={title} aria-label="اسم الحساب" style={{ flex: "1 1 220px", width: "auto" }} />
        <select name="order_id" defaultValue="" aria-label="أمر العمل" style={{ flex: "1 1 200px", width: "auto" }}>
          <option value="">بدون أمر عمل</option>
          {(orders ?? []).map((o) => <option key={o.id} value={o.id}>#{o.no} · {o.product}</option>)}
        </select>
        {parts && <label className="row" style={{ gap: 4, fontSize: 13 }}><input type="checkbox" name="parts" defaultChecked /> {kind === "tank" ? "أضف ألواح الحلقات لقطع القص بالأمر" : "أضف ألواح الجسم وأقراص الرؤوس لقطع القص بالأمر"}</label>}
        <button className="btn" type="submit">حفظ</button>
      </div>
    </form>
  );
}
