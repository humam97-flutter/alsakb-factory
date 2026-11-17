import { Alert, Input, type PageProps } from "@/components/ui";
import { GroupedBars } from "@/components/charts";
import { Icon } from "@/components/icons";
import { can, getMe } from "@/lib/auth";
import { getCutSettings } from "@/lib/cutting";
import { money, num } from "@/lib/labels";
import { supabase } from "@/lib/supabase/server";
import { saveCutSettings } from "../actions";

// تقرير الهدر: كم كغم وكم دينار راح هدر بالقص، شهرياً وحسب النوع والسمك
export default async function CutReportPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const me = await getMe();
  const db = await supabase();
  const s = await getCutSettings();
  const { data } = await db.from("cut_loss_monthly").select("*").order("month", { ascending: false }).limit(500);
  const rows = (data ?? []).map((r) => ({ ...r, plate_kg: Number(r.plate_kg), parts_kg: Number(r.parts_kg), remnant_kg: Number(r.remnant_kg), scrap_kg: Number(r.scrap_kg), loss_value: Number(r.loss_value) }));
  const months = [...new Set(rows.map((r) => r.month as string))].sort();
  const byMonth = months.map((m) => {
    const rs = rows.filter((r) => r.month === m);
    const t = (k: "plate_kg" | "parts_kg" | "remnant_kg" | "scrap_kg" | "loss_value") => rs.reduce((a, r) => a + r[k], 0);
    return { m, plates: rs.reduce((a, r) => a + Number(r.plates), 0), plate: t("plate_kg"), parts: t("parts_kg"), rem: t("remnant_kg"), scrap: t("scrap_kg"), loss: t("loss_value") };
  });
  const cur = byMonth[byMonth.length - 1];
  const wasteOf = (x?: { scrap: number; plate: number }) => (x && x.plate ? (x.scrap / x.plate) * 100 : 0);
  const yieldOf = (x?: { parts: number; plate: number }) => (x && x.plate ? (x.parts / x.plate) * 100 : 0);
  const last6 = byMonth.slice(-6);

  return (
    <>
      <Alert error={sp.error} ok={sp.ok} />
      <div className="bar"><h2>تقرير الهدر والخسارة</h2></div>
      {!rows.length ? (
        <div className="empty">ما بيه قص منفذ بعد. التقرير يمتلي تلقائياً من «تم القص» بمخططات القص.</div>
      ) : (
        <>
          <div className="kpis">
            <div className="kpi"><span className="kpi-ic tone-info"><Icon name="cut" size={18} /></span><span>ألواح انقصت ({cur.m.slice(0, 7)})</span><b>{cur.plates}</b></div>
            <div className="kpi"><span className={`kpi-ic ${wasteOf(cur) > s.alertPct ? "tone-bad" : "tone-ok"}`}><Icon name="check" size={18} /></span><span>نسبة الاستغلال</span><b>{yieldOf(cur).toFixed(1)}%</b></div>
            <div className="kpi"><span className="kpi-ic tone-warn"><Icon name="scale" size={18} /></span><span>هدر الشهر</span><b>{num(Math.round(cur.scrap))} كغم</b></div>
            <div className="kpi"><span className="kpi-ic tone-bad"><Icon name="money" size={18} /></span><span>خسارة الشهر</span><b>{money(cur.loss)}</b></div>
          </div>
          {last6.length > 1 && (
            <div className="panel" style={{ marginBottom: 14 }}>
              <b>الهدر والبقايا بالكغم، آخر {last6.length} أشهر</b>
              <GroupedBars
                unit="كغم"
                labels={last6.map((x) => x.m.slice(0, 7))}
                series={[
                  { name: "هدر", color: "var(--bad)", values: last6.map((x) => x.scrap) },
                  { name: "بقايا رجعت", color: "var(--ok)", values: last6.map((x) => x.rem) },
                ]}
              />
            </div>
          )}
          <h3 className="sec">حسب الشهر</h3>
          <div className="tbl">
            <table>
              <thead><tr><th>الشهر</th><th className="n">ألواح</th><th className="n">وزن الألواح</th><th className="n">القطع</th><th className="n">البقايا</th><th className="n">الهدر</th><th className="n">الاستغلال</th><th className="n">الخسارة</th></tr></thead>
              <tbody>
                {[...byMonth].reverse().map((x) => (
                  <tr key={x.m}>
                    <td className="num">{x.m.slice(0, 7)}</td>
                    <td className="n num">{x.plates}</td>
                    <td className="n num">{num(Math.round(x.plate))}</td>
                    <td className="n num">{num(Math.round(x.parts))}</td>
                    <td className="n num">{num(Math.round(x.rem))}</td>
                    <td className="n num">{num(Math.round(x.scrap))}</td>
                    <td className={`n num ${wasteOf(x) > s.alertPct ? "neg" : ""}`}>{yieldOf(x).toFixed(1)}%</td>
                    <td className="n num">{money(x.loss)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <h3 className="sec">حسب النوع والسمك</h3>
          <div className="tbl">
            <table>
              <thead><tr><th>الشهر</th><th>النوع</th><th className="n">السمك</th><th className="n">ألواح</th><th className="n">الهدر كغم</th><th className="n">الاستغلال</th><th className="n">الخسارة</th></tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td className="num">{String(r.month).slice(0, 7)}</td>
                    <td>{r.grade}</td>
                    <td className="n num">{num(r.thickness)}</td>
                    <td className="n num">{r.plates}</td>
                    <td className="n num">{num(Math.round(r.scrap_kg))}</td>
                    <td className="n num">{r.plate_kg ? ((r.parts_kg / r.plate_kg) * 100).toFixed(1) : 0}%</td>
                    <td className="n num">{money(r.loss_value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {can.production(me.role) && (
        <>
          <h3 className="sec">إعدادات القص</h3>
          <form action={saveCutSettings} className="panel">
            <div className="fields">
              <Input name="kerf_mm" label="عرض خط القص (ملم)" type="number" value={s.kerf} />
              <Input name="edge_mm" label="حافة اللوح غير المستغلة (ملم)" type="number" value={s.edge} />
              <Input name="min_remnant_mm" label="أصغر بقية تنحفظ (ملم)" type="number" value={s.minRemnant} />
              <Input name="scrap_price" label="سعر بيع كغم السكراب (دينار)" type="number" value={s.scrapPrice} />
              <Input name="loss_alert_pct" label="نبهني إذا الهدر أكثر من (%)" type="number" value={s.alertPct} />
              <Input name="plate_sizes" label="قياسات الألواح اللي تشتريها" value={s.sizesText} full />
            </div>
            <div className="actions"><button className="btn" type="submit">حفظ</button></div>
            <p className="meta" style={{ marginBottom: 0 }}>
              عرض القص تقريباً: بلازما 2 إلى 4 ملم، أوكسي أستيلين 1.5 إلى 3، ليزر 0.2 إلى 0.5. القياسات بالشكل 6000x1500 ويفصلها فارزة.
            </p>
          </form>
        </>
      )}
    </>
  );
}
