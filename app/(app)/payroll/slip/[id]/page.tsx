import { Letterhead, Signatures } from "@/components/letterhead";
import { getBrand } from "@/lib/brand";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/print-button";
import type { IdPageProps } from "@/components/ui";
import { can, requireRole } from "@/lib/auth";
import { money, num, PAYMENT, today } from "@/lib/labels";
import { waLink } from "@/lib/share";
import { supabase } from "@/lib/supabase/server";

// كشف راتب عامل لشهر: للطباعة أو الإرسال بالواتساب
export default async function SlipPage({ params, searchParams }: IdPageProps) {
  await requireRole(can.finance);
  const { id } = await params;
  const sp = await searchParams;
  const month = sp.month ?? today().slice(0, 7);
  const first = `${month}-01`;
  const next = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 1)).toISOString().slice(0, 10);
  const db = await supabase();
  const [{ data: w }, { data: r }, { data: pays }, { data: att }, brand] = await Promise.all([
    db.from("workers").select("id, full_name, job, phone").eq("id", id).maybeSingle(),
    db.from("monthly_payroll").select("*").eq("worker_id", id).eq("month", first).maybeSingle(),
    db.from("worker_payments").select("*").eq("worker_id", id).gte("day", first).lt("day", next).order("day"),
    db.from("attendance").select("status").eq("worker_id", id).gte("day", first).lt("day", next),
    getBrand(),
  ]);
  if (!w) notFound();
  const cur = r?.currency ?? "IQD";
  const count = (st: string) => (att ?? []).filter((a) => a.status === st).length;
  const lines: [string, string][] = [
    ["الأجر اليومي", money(r?.daily_wage, cur)],
    ["أيام الحضور", num(r?.days ?? 0)],
    ["الساعات الإضافية", num(r?.overtime_hours ?? 0)],
    ["المستحق", money(r?.earned, cur)],
    ["المكافآت", money(r?.bonus, cur)],
    ["الخصومات", money(r?.deduction, cur)],
    ["السلف", money(r?.advance, cur)],
    ["المدفوع", money(r?.paid, cur)],
  ];
  const msg = `${brand.name}\nكشف راتب ${w.full_name} لشهر ${month}\n` + lines.map(([k, v]) => `${k}: ${v}`).join("\n") + `\nالباقي لك: ${money(r?.balance, cur)}`;
  return (
    <div className="paper" style={{ maxWidth: 720 }}>
      <div className="noprint actions" style={{ marginTop: 0, marginBottom: 12, paddingTop: 0, borderTop: 0 }}>
        <PrintButton />
        <a className="btn ghost" target="_blank" rel="noopener" href={waLink(w.phone, msg)}>إرسال للعامل بالواتساب</a>
      </div>
      <Letterhead brand={brand} title="كشف راتب" info={[["الشهر", month], ["العامل", w.full_name], ["العمل", w.job]]} />
      <p style={{ fontSize: 13 }}>حاضر {count("present")} · نصف يوم {count("half")} · غائب {count("absent")} · إجازة {count("leave")}</p>
      <table>
        <tbody>
          {lines.map(([k, v]) => <tr key={k}><td>{k}</td><td className="n num">{v}</td></tr>)}
          <tr><td><b>الباقي له</b></td><td className="n num"><b>{money(r?.balance, cur)}</b></td></tr>
        </tbody>
      </table>
      {pays && pays.length > 0 && (
        <>
          <h3 style={{ marginBottom: 6 }}>الدفعات</h3>
          <table>
            <tbody>
              {pays.map((p) => <tr key={p.id}><td className="num">{p.day}</td><td>{PAYMENT[p.kind]?.label}</td><td>{p.note}</td><td className="n num">{money(p.amount, p.currency)}</td></tr>)}
            </tbody>
          </table>
        </>
      )}
      <Signatures names={["المحاسب", "المدير", "توقيع العامل"]} manager={brand.manager_name} />
    </div>
  );
}
