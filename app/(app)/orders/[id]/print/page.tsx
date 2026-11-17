import { notFound } from "next/navigation";
import { Letterhead, Signatures } from "@/components/letterhead";
import { PrintButton } from "@/components/print-button";
import { getBrand } from "@/lib/brand";
import type { IdPageProps } from "@/components/ui";
import { num, PRIORITY, today } from "@/lib/labels";
import { qrSvg, siteUrl } from "@/lib/qr";
import { supabase } from "@/lib/supabase/server";

// ورقة الشغل للعمال: بدون أسعار
export default async function PrintOrderPage({ params }: IdPageProps) {
  const { id } = await params;
  const db = await supabase();
  const [{ data: o }, { data: stages }, { data: machines }] = await Promise.all([
    db.from("work_orders").select("*, owner:workers(full_name)").eq("id", id).maybeSingle(),
    db.from("work_order_stages").select("position, name, machine:machines(name)").eq("order_id", id).order("position"),
    db.from("machines").select("id, name"),
  ]);
  if (!o) notFound();
  const brand = await getBrand();
  const qr = await qrSvg(await siteUrl(`/orders/${o.id}`));
  const mName = new Map((machines ?? []).map((m) => [m.id, m.name]));
  const rows: [string, string | null][] = [
    ["المنتج", o.product],
    ["الزبون", o.client],
    ["الكمية", o.qty ? `${num(o.qty)} ${o.unit ?? ""}` : null],
    ["تاريخ البدء", o.start_date],
    ["موعد التسليم", o.due_date],
    ["الأولوية", PRIORITY[o.priority]?.label],
    ["المسؤول", (o.owner as { full_name: string } | null)?.full_name ?? null],
    ["المكائن", (o.machines as string[]).map((m) => mName.get(m)).filter(Boolean).join("، ")],
  ];
  return (
    <div className="paper">
      <div className="noprint actions" style={{ marginTop: 0, marginBottom: 16, paddingTop: 0, borderTop: 0 }}>
        <PrintButton />
      </div>
      <Letterhead brand={brand} title={`أمر عمل #${o.no}`} info={[["تاريخ الطباعة", today()]]} />
      <div style={{ float: "left", marginInlineStart: 16, fontSize: 11, textAlign: "center", color: "#444" }}>
        <div style={{ width: 92, height: 92 }} dangerouslySetInnerHTML={{ __html: qr }} />
        صوّره لتحديث المراحل
      </div>
      <table style={{ width: "auto", minWidth: "60%" }}>
        <tbody>
          {rows
            .filter(([, v]) => v)
            .map(([l, v]) => (
              <tr key={l}>
                <th style={{ width: "28%", fontSize: 13.5 }}>{l}</th>
                <td style={{ whiteSpace: "normal" }}>{v}</td>
              </tr>
            ))}
        </tbody>
      </table>
      <h3 style={{ marginBottom: 6 }}>المراحل</h3>
      <table style={{ width: "auto", minWidth: "60%" }}>
        <thead>
          <tr>
            <th>#</th>
            <th>المرحلة</th>
            <th>الماكنة</th>
            <th>المنفذ</th>
            <th>التاريخ</th>
          </tr>
        </thead>
        <tbody>
          {(stages ?? []).map((s) => (
            <tr key={s.position}>
              <td>{s.position}</td>
              <td>{s.name}</td>
              <td>{(s.machine as unknown as { name: string } | null)?.name ?? ""}</td>
              <td style={{ minWidth: 120 }}></td>
              <td style={{ minWidth: 90 }}></td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ border: "1px solid #999", minHeight: 110, padding: 8, marginTop: 14, whiteSpace: "pre-wrap" }}>
        <b>ملاحظات وتعليمات:</b>
        {"\n"}
        {o.notes}
      </div>
      <Signatures names={["المسؤول", "مدير الإنتاج", "فحص الجودة"]} />
    </div>
  );
}
