import Link from "next/link";
import { Alert, type PageProps } from "@/components/ui";
import { CURRENCIES, money, today } from "@/lib/labels";
import { GUARANTEE_KIND, GUARANTEE_STATUS } from "@/lib/projects";
import { supabase } from "@/lib/supabase/server";
import { deleteGuarantee, saveGuarantee, setGuaranteeStatus } from "../actions";

// كل خطابات الضمان: الساري، المنتهي، والقريب من الانتهاء
export default async function GuaranteesPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const db = await supabase();
  const t = today();
  const soon = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const [{ data: gs }, { data: projects }, { data: tenders }, { data: customers }] = await Promise.all([
    db.from("guarantees").select("*, project:projects(id, no, name), tender:tenders(id, no, title), customer:customers(name)").order("status").order("expires_on"),
    db.from("projects").select("id, no, name").in("status", ["active", "hold"]).order("no", { ascending: false }),
    db.from("tenders").select("id, no, title").in("status", ["preparing", "submitted"]).order("no", { ascending: false }),
    db.from("customers").select("id, name").eq("active", true).order("name"),
  ]);
  const list = gs ?? [];
  const active = list.filter((g) => g.status === "active");
  const sum = (cur: string, f: (g: (typeof list)[number]) => number) => active.filter((g) => g.currency === cur).reduce((a, g) => a + f(g), 0);
  const curs = [...new Set(active.map((g) => g.currency))].sort();
  const multi = (f: (g: (typeof list)[number]) => number) => (curs.length ? curs.map((c) => money(sum(c, f), c)).join(" + ") : "—");
  const expiring = active.filter((g) => g.expires_on && g.expires_on <= soon);
  return (
    <>
      <Alert error={sp.error} ok={sp.ok} />
      <div className="bar"><h2>خطابات الضمان</h2></div>
      <div className="kpis">
        <div className="kpi"><span>الساري</span><b>{active.length}</b></div>
        <div className="kpi"><span>مجموع المبالغ السارية</span><b>{multi((g) => Number(g.amount))}</b></div>
        <div className="kpi"><span>تأمينات نقدية محجوزة بالمصارف</span><b>{multi((g) => Number(g.cash_margin))}</b></div>
        <div className="kpi"><span>تنتهي خلال 30 يوم أو منتهية</span><b className={expiring.length ? "neg" : ""}>{expiring.length}</b></div>
      </div>
      {list.length ? (
        <div className="tbl">
          <table>
            <thead><tr><th>النوع</th><th>المصرف · الرقم</th><th>المشروع / المناقصة</th><th className="n">المبلغ</th><th>الانتهاء</th><th>الحالة</th><th></th></tr></thead>
            <tbody>
              {list.map((g) => {
                const exp = g.status === "active" && g.expires_on && g.expires_on < t;
                const near = g.status === "active" && !exp && g.expires_on && g.expires_on <= soon;
                const pr = g.project as { id: string; no: number; name: string } | null;
                const tn = g.tender as { id: string; no: number; title: string } | null;
                return (
                  <tr key={g.id} style={g.status !== "active" ? { opacity: 0.6 } : undefined}>
                    <td>{GUARANTEE_KIND[g.kind]}</td>
                    <td>{g.bank}<div className="meta num">{g.ref_no}</div></td>
                    <td>{pr ? <Link href={`/projects/${pr.id}`}>مشروع #{pr.no} {pr.name}</Link> : tn ? <Link href="/projects/tenders">مناقصة #{tn.no} {tn.title}</Link> : (g.customer as { name: string } | null)?.name}</td>
                    <td className="n num">{money(g.amount, g.currency)}{Number(g.fee) ? <div className="meta">{`عمولة ${money(g.fee, g.currency)}`}</div> : null}</td>
                    <td className="num">{g.expires_on ?? "—"}</td>
                    <td><span className={`pill tone-${exp ? "bad" : near ? "warn" : GUARANTEE_STATUS[g.status]?.tone}`}>{exp ? "منتهي، جدده أو استرده" : near ? "ينتهي قريباً" : GUARANTEE_STATUS[g.status]?.label}</span></td>
                    <td>
                      <div className="row" style={{ gap: 4, flexWrap: "nowrap" }}>
                        {g.status === "active" && (
                          <>
                            <form action={setGuaranteeStatus}><input type="hidden" name="id" value={g.id} /><input type="hidden" name="status" value="released" /><button className="btn ghost sm" type="submit">استرداد</button></form>
                            <form action={setGuaranteeStatus}><input type="hidden" name="id" value={g.id} /><input type="hidden" name="status" value="claimed" /><button className="btn ghost sm" type="submit">مصادرة</button></form>
                          </>
                        )}
                        <form action={deleteGuarantee}><input type="hidden" name="id" value={g.id} /><button className="btn ghost sm" type="submit" aria-label="حذف">×</button></form>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : <div className="empty">ما اكو خطابات ضمان مسجلة.</div>}

      <h3 className="sec">خطاب ضمان جديد</h3>
      <form action={saveGuarantee} className="panel">
        <div className="fields">
          <label>النوع<select name="kind" defaultValue="performance">{Object.entries(GUARANTEE_KIND).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <label>المشروع<select name="project_id" defaultValue=""><option value="">-</option>{(projects ?? []).map((p) => <option key={p.id} value={p.id}>#{p.no} {p.name}</option>)}</select></label>
          <label>أو المناقصة<select name="tender_id" defaultValue=""><option value="">-</option>{(tenders ?? []).map((x) => <option key={x.id} value={x.id}>#{x.no} {x.title}</option>)}</select></label>
          <label>الجهة المستفيدة<select name="customer_id" defaultValue=""><option value="">-</option>{(customers ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <label>المصرف<input name="bank" /></label>
          <label>رقم الخطاب<input name="ref_no" /></label>
          <label>المبلغ<input name="amount" type="number" step="any" required /></label>
          <label>العملة<select name="currency" defaultValue="IQD">{Object.entries(CURRENCIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <label>تاريخ الإصدار<input name="issued_on" type="date" defaultValue={t} /></label>
          <label>تاريخ الانتهاء<input name="expires_on" type="date" /></label>
          <label>عمولة المصرف<input name="fee" type="number" step="any" /></label>
          <label>التأمينات النقدية<input name="cash_margin" type="number" step="any" /></label>
          <label className="full">ملاحظات<input name="notes" /></label>
        </div>
        <div className="actions"><button className="btn" type="submit">حفظ</button></div>
      </form>
    </>
  );
}
