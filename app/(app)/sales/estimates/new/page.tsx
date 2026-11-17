import { Alert, type PageProps } from "@/components/ui";
import { PRODUCT_TYPE } from "@/lib/estimate";
import { num } from "@/lib/labels";
import { supabase } from "@/lib/supabase/server";
import { createEstimate } from "../actions";

export default async function NewEstimatePage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const db = await supabase();
  const [{ data: calcs }, { data: customers }, { data: loss }] = await Promise.all([
    db.from("calcs").select("id, kind, title, results, created_at").in("kind", ["vessel", "tank"]).order("created_at", { ascending: false }).limit(100),
    db.from("customers").select("id, name").eq("active", true).order("name"),
    db.from("cut_loss_monthly").select("plate_kg, scrap_kg"),
  ]);
  const pk = (loss ?? []).reduce((a, r) => a + Number(r.plate_kg), 0);
  const sk = (loss ?? []).reduce((a, r) => a + Number(r.scrap_kg), 0);
  const actual = pk > 2000 ? Math.round((sk / pk) * 1000) / 10 : null;

  return (
    <>
      <Alert error={sp.error} />
      <div className="bar"><h2>تقدير جديد</h2></div>
      <form action={createEstimate} className="panel">
        <div className="fields">
          <label className="full">العنوان (يطلع بعرض السعر)<input name="title" required placeholder="مثلاً: وعاء ضغط هواء 5 م³ · 10 بار" defaultValue={sp.title} /></label>
          <label>
            الزبون
            <select name="customer_id" defaultValue="">
              <option value="">زبون جديد أو بدون</option>
              {(customers ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label>اسم زبون جديد<input name="new_customer" /></label>
          <label>
            من حساب هندسي محفوظ
            <select name="calc_id" defaultValue={sp.calc ?? ""}>
              <option value="">بدون، أحسب من الوزن</option>
              {(calcs ?? []).map((c) => {
                const r = c.results as Record<string, number>;
                return <option key={c.id} value={c.id}>{c.title}{r.emptyKg ? ` · ${num(Math.round(r.emptyKg))} كغم` : r.totalKg ? ` · ${num(Math.round(r.totalKg))} كغم` : ""}</option>;
              })}
            </select>
          </label>
          <label>
            النوع (إذا من الوزن)
            <select name="product_type" defaultValue="structure">
              {Object.entries(PRODUCT_TYPE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label>الوزن الصافي التقريبي (كغم)<input name="weight_kg" type="number" step="any" inputMode="decimal" /></label>
          <label>العدد (قطع بنفس المواصفات)<input name="qty" type="number" min="1" defaultValue={1} /></label>
          <label>
            العملة
            <select name="currency" defaultValue="IQD"><option value="IQD">دينار</option><option value="USD">دولار</option></select>
          </label>
          <label className="row" style={{ gap: 6, alignSelf: "end" }}><input type="checkbox" name="plates" /> الشغل أغلبه صاج (للحساب من الوزن)</label>
          {actual !== null && <label className="row" style={{ gap: 6, alignSelf: "end" }}><input type="checkbox" name="use_actual" defaultChecked /> استخدم هدر القص الفعلي بالمعمل ({actual}%)</label>}
          <label className="full">ملاحظات<textarea name="notes" rows={2} /></label>
        </div>
        <div className="actions"><button className="btn" type="submit">ولّد التقدير</button></div>
        <p className="meta" style={{ marginBottom: 0 }}>
          البنود تنولد تلقائياً بأسعار الكلف المحفوظة: المواد والهدر، الأقطاب، ساعات كل مرحلة، الفحوصات، السفع والصبغ، والنقل. بعدها تعدل أي بند.
        </p>
      </form>
    </>
  );
}
