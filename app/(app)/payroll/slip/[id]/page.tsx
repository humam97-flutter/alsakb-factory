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
  const [{ data: w }, { data: r }, { data: pays }, { data: att }, { data: s }] = await Promise.all([
    db.from("workers").select("id, full_name, job, phone").eq("id", id).maybeSingle(),
    db.from("monthly_payroll").select("*").eq("worker_id", id).eq("month", first).maybeSingle(),
    db.from("worker_payments").select("*").eq("worker_id", id).gte("day", first).lt("day", next).order("day"),
    db.from("attendance").select("status").eq("worker_id", id).gte("day", first).lt("day", next),
    db.from("settings").select("factory_name").eq("id", 1).maybeSingle(),
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
  const msg = `${s?.factory_name ?? "معمل السكب الحديدي"}\nكشف راتب ${w.full_name} لشهر ${month}\n` + lines.map(([k, v]) => `${k}: ${v}`).join("\n") + `\nالباقي لك: ${money(r?.balance, cur)}`;
  return (
    <div style={{ background: "#fff", color: "#000", padding: 24, borderRadius: 8, maxWidth: 640 }}>
      <div className="noprint actions" style={{ marginTop: 0, marginBottom: 12 }}>
        <PrintButton />
        <a className="btn ghost" target="_blank" rel="noopener" href={waLink(w.phone, msg)}>إرسال للعامل بالواتساب</a>
      </div>
      <div className="row between" style={{ borderBottom: "3px solid #000", paddingBottom: 8, marginBottom: 12 }}>
        <div><h2 style={{ margin: 0 }}>كشف راتب</h2><div>{s?.factory_name ?? "معمل السكب الحديدي"}</div></div>
        <div style={{ textAlign: "end" }}><b>{w.full_name}</b>{w.job && <div>{w.job}</div>}<div className="num">{month}</div></div>
      </div>
      <p style={{ fontSize: 13 }}>حاضر {count("present")} · نصف يوم {count("half")} · غائب {count("absent")} · إجازة {count("leave")}</p>
      <table style={{ border: "1px solid #999" }}>
        <tbody>
          {lines.map(([k, v]) => <tr key={k}><td>{k}</td><td className="n num">{v}</td></tr>)}
          <tr><td><b>الباقي له</b></td><td className="n num"><b>{money(r?.balance, cur)}</b></td></tr>
        </tbody>
      </table>
      {pays && pays.length > 0 && (
        <>
          <h3 style={{ marginBottom: 6 }}>الدفعات</h3>
          <table style={{ border: "1px solid #999" }}>
            <tbody>
              {pays.map((p) => <tr key={p.id}><td className="num">{p.day}</td><td>{PAYMENT[p.kind]?.label}</td><td>{p.note}</td><td className="n num">{money(p.amount, p.currency)}</td></tr>)}
            </tbody>
          </table>
        </>
      )}
      <div className="row" style={{ marginTop: 48, gap: 24 }}>
        {["المحاسب", "توقيع العامل"].map((x) => <div key={x} style={{ flex: 1, borderTop: "1px solid #000", paddingTop: 6, textAlign: "center" }}>{x}</div>)}
      </div>
    </div>
  );
}
