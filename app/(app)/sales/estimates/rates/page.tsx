import { Alert, type PageProps } from "@/components/ui";
import { DEFAULT_RATES, mergeRates, RATE_LABELS, STAGE_SPLIT, type Rates } from "@/lib/estimate";
import { num } from "@/lib/labels";
import { supabase } from "@/lib/supabase/server";
import { saveRates } from "../actions";

export default async function RatesPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const db = await supabase();
  const { data } = await db.from("settings").select("est_rates").eq("id", 1).maybeSingle();
  const r = mergeRates(data?.est_rates);
  const keys = Object.keys(DEFAULT_RATES) as (keyof Rates)[];
  const groups: [string, (keyof Rates)[]][] = [
    ["المواد", ["plate_kg", "section_kg", "waste_pct", "accessories_pct", "head_forming_kg"]],
    ["اللحام والعمل", ["electrode_kg", "consumables_pct", "labor_hour", "hours_vessel", "hours_tank", "hours_structure", "hours_other"]],
    ["الفحص والصبغ والنقل", ["rt_film", "pt_m", "hydro", "paint_l", "blast_m2", "docs", "transport"]],
    ["التسعير", ["overhead_pct", "contingency_pct", "margin_pct"]],
  ];
  const shown = new Set(groups.flatMap(([, k]) => k));
  return (
    <>
      <Alert error={sp.error} ok={sp.ok} />
      <div className="bar"><h2>أسعار الكلف للتقدير</h2></div>
      <form action={saveRates}>
        {groups.map(([title, ks]) => (
          <div key={title} className="panel" style={{ marginBottom: 12 }}>
            <b>{title}</b>
            <div className="fields" style={{ marginTop: 8 }}>
              {ks.map((k) => (
                <label key={k}>
                  {RATE_LABELS[k][0]} ({RATE_LABELS[k][1]})
                  <input name={k} type="number" step="any" inputMode="decimal" defaultValue={r[k]} />
                  {r[k] !== DEFAULT_RATES[k] && <small className="meta">الافتراضي {num(DEFAULT_RATES[k])}</small>}
                </label>
              ))}
            </div>
          </div>
        ))}
        {keys.filter((k) => !shown.has(k)).map((k) => <input key={k} type="hidden" name={k} value={r[k]} />)}
        <div className="actions"><button className="btn" type="submit">حفظ الأسعار</button></div>
      </form>
      <h3 className="sec">توزيع ساعات العمل على المراحل</h3>
      <div className="tbl">
        <table data-plain>
          <thead><tr><th>النوع</th><th>المراحل (% من الساعات)</th></tr></thead>
          <tbody>
            {Object.entries(STAGE_SPLIT).map(([k, s]) => (
              <tr key={k}><td>{{ vessel: "وعاء ضغط", tank: "خزان", structure: "هيكل", other: "أخرى" }[k]}</td><td>{s.map(([n, p]) => `${n} ${p}%`).join("، ")}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="meta">ساعات اللحام بالأوعية والخزانات تنحسب من طول اللحام الفعلي، والباقي يتوزع بهذي النسب. هذي قيم أولية، صححها من تجربتكم أو من «المقدّر مقابل الفعلي».</p>
    </>
  );
}
