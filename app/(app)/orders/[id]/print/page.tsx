import { notFound } from "next/navigation";
import { PrintButton } from "@/components/print-button";
import type { IdPageProps } from "@/components/ui";
import { num, PRIORITY, today } from "@/lib/labels";
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
    <div style={{ background: "#fff", color: "#000", padding: 24, borderRadius: 8 }}>
      <div className="noprint actions" style={{ marginTop: 0, marginBottom: 16 }}>
        <PrintButton />
      </div>
      <div className="row between" style={{ borderBottom: "3px solid #000", paddingBottom: 8, marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22 }}>أمر عمل #{o.no}</h2>
          <div>معمل السكب الحديدي</div>
        </div>
        <div>تاريخ الطباعة: {today()}</div>
      </div>
      <table style={{ border: "1px solid #999" }}>
        <tbody>
          {rows
            .filter(([, v]) => v)
            .map(([l, v]) => (
              <tr key={l}>
                <th style={{ width: "28%", background: "#eee", color: "#000", fontSize: 14 }}>{l}</th>
                <td style={{ whiteSpace: "normal" }}>{v}</td>
              </tr>
            ))}
        </tbody>
      </table>
      <h3 style={{ marginBottom: 6 }}>المراحل</h3>
      <table style={{ border: "1px solid #999" }}>
        <thead>
          <tr>
            <th style={{ color: "#000" }}>#</th>
            <th style={{ color: "#000" }}>المرحلة</th>
            <th style={{ color: "#000" }}>الماكنة</th>
            <th style={{ color: "#000" }}>المنفذ</th>
            <th style={{ color: "#000" }}>التاريخ</th>
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
      <div className="row" style={{ marginTop: 48, gap: 24 }}>
        {["المسؤول", "مدير الإنتاج", "فحص الجودة"].map((s) => (
          <div key={s} style={{ flex: 1, borderTop: "1px solid #000", paddingTop: 6, textAlign: "center" }}>
            {s}
          </div>
        ))}
      </div>
    </div>
  );
}
