import { Alert, type PageProps } from "@/components/ui";
import { can, requireRole } from "@/lib/auth";
import { CUT_MACHINE, CUT_RATE_LABELS, mergeCutRates, type CutRates } from "@/lib/cut-cost";
import { supabase } from "@/lib/supabase/server";
import { saveCutRates } from "../actions";

export default async function CutRatesPage({ searchParams }: PageProps) {
  const { error, ok } = await searchParams;
  await requireRole(can.users);
  const db = await supabase();
  const { data } = await db.from("settings").select("cut_rates").eq("id", 1).maybeSingle();
  const r = mergeCutRates(data?.cut_rates);
  return (
    <>
      <Alert error={error} ok={ok} />
      <div className="bar"><h2>سرعات وأسعار القص</h2></div>
      <p className="meta" style={{ marginTop: -6 }}>القيم الحالية افتراضية لماكنة بلازما 130 أمبير وليزر فايبر 3 كيلوواط. عدّلها من كتالوج مكائنكم أو من وقت قص فعلي (مثلاً قص 10 متر سمك 10 وحسب الدقائق).</p>
      <form action={saveCutRates} className="panel">
        <div className="fields">
          <label>الماكنة الأساسية
            <select name="machine" defaultValue={r.machine}>{Object.entries(CUT_MACHINE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          </label>
          {(Object.keys(CUT_RATE_LABELS) as (keyof typeof CUT_RATE_LABELS)[]).map((k) => (
            <label key={k} className={k.endsWith("_speed") ? "full" : undefined}>
              {CUT_RATE_LABELS[k][0]} <small>{CUT_RATE_LABELS[k][1]}</small>
              <input name={k} defaultValue={String(r[k as keyof CutRates])} dir={k.endsWith("_speed") ? "ltr" : undefined} inputMode={k.endsWith("_speed") ? undefined : "decimal"} />
            </label>
          ))}
        </div>
        <div className="actions"><button className="btn" type="submit">حفظ</button></div>
      </form>
    </>
  );
}
