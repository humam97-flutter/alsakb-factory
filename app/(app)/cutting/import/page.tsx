import Link from "next/link";
import { Alert, type PageProps } from "@/components/ui";
import { can, requireRole } from "@/lib/auth";
import { mergeCutRates } from "@/lib/cut-cost";
import { getCutSettings, GRADES } from "@/lib/cutting";
import { mergeRates } from "@/lib/estimate";
import type { Plate } from "@/lib/nesting";
import type { Center } from "@/lib/planning";
import { supabase } from "@/lib/supabase/server";
import { Importer } from "./importer";

// رفع مخطط التصميم (DXF): القطع ← الألواح والهدر ← الكلفة والوقت ← تسعيرة أو أمر عمل
export default async function ImportPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const me = await requireRole((r) => r === "manager" || r === "production" || r === "accountant");
  const db = await supabase();
  const s = await getCutSettings();
  const [{ data: st }, { data: plates }, { data: centers }, { data: customers }, { data: price }, { data: recent }] = await Promise.all([
    db.from("settings").select("est_rates, cut_rates, usd_rate").eq("id", 1).maybeSingle(),
    db.from("plates").select("id, serial, grade, thickness, length_mm, width_mm, density, price_kg, parent_id, location").eq("status", "available"),
    db.from("work_centers").select("*").eq("active", true).order("position"),
    db.from("customers").select("id, name").eq("active", true).order("name"),
    db.from("steel_prices").select("price_ton, currency, day, source").eq("item", "صاج أسود").order("day", { ascending: false }).limit(1).maybeSingle(),
    db.from("drawings").select("id, no, title, job_type, summary, order_id, estimate_id, created_at").order("created_at", { ascending: false }).limit(8),
  ]);
  const rates = mergeRates(st?.est_rates);
  const rate = Number(st?.usd_rate ?? 1500);
  const market = price ? Math.round((price.currency === "USD" ? Number(price.price_ton) * rate : Number(price.price_ton)) / 1000) : null;
  return (
    <>
      <Alert error={sp.error} ok={sp.ok} />
      <div className="bar">
        <h2>مخطط تصميم ← قص وكلفة ووقت</h2>
        {can.users(me.role) && <Link className="btn ghost sm" href="/cutting/import/rates">سرعات وأسعار القص</Link>}
      </div>
      <p className="meta" style={{ marginTop: -6 }}>ارفع ملف DXF من AutoCAD أو SolidWorks أو أي برنامج رسم. النظام يطلّع القطع، يرتبها على الألواح بأقل هدر، ويحسب المادة ووقت القص والتصنيع والكلفة، وبعدين تسويه تسعيرة أو أمر عمل بخطة إنتاج.</p>
      <Importer
        plates={(plates ?? []) as Plate[]}
        settings={{ kerf: s.kerf, edge: s.edge, minRemnant: s.minRemnant, sizes: s.sizes, scrapPrice: s.scrapPrice }}
        rates={rates}
        cut={mergeCutRates(st?.cut_rates)}
        centers={(centers ?? []) as Center[]}
        customers={customers ?? []}
        grades={[...new Set([...GRADES, ...(plates ?? []).map((p) => p.grade)])]}
        priceKg={market ?? rates.plate_kg}
        priceNote={market ? `من سعر السوق ${price!.day}${price!.source ? ` (${price!.source})` : ""}` : "من أسعار التسعير"}
        finance={can.finance(me.role)}
        production={can.production(me.role)}
      />
      {(recent ?? []).length > 0 && (
        <>
          <h3 className="sec">آخر المخططات</h3>
          <div className="tbl">
            <table data-plain>
              <thead><tr><th>#</th><th>العنوان</th><th className="n">الألواح</th><th className="n">الكلفة</th><th /></tr></thead>
              <tbody>
                {(recent ?? []).map((d) => {
                  const sm = d.summary as { sheets?: number; price?: number };
                  return (
                    <tr key={d.id}>
                      <td className="num">{d.no}</td>
                      <td>{d.title}</td>
                      <td className="n num">{sm.sheets ?? ""}</td>
                      <td className="n num">{sm.price ? Number(sm.price).toLocaleString("en-US") : ""}</td>
                      <td>
                        {d.order_id && <Link href={`/orders/${d.order_id}`}>أمر العمل</Link>}
                        {d.order_id && d.estimate_id && " · "}
                        {d.estimate_id && <Link href={`/sales/estimates/${d.estimate_id}`}>التسعيرة</Link>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
