import Link from "next/link";
import { Alert, type PageProps } from "@/components/ui";
import { money, today } from "@/lib/labels";
import { summarize } from "@/lib/project-summary";
import { PROJECT_STATUS } from "@/lib/projects";
import { supabase } from "@/lib/supabase/server";

// كل المشاريع: قيمة العقد، الإنجاز الفعلي مقابل المفوتر، والمستحق
export default async function ProjectsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const db = await supabase();
  const t = today();
  const soon = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const show = sp.all ? ["active", "hold", "done", "cancelled"] : ["active", "hold"];
  const [{ data: projects }, { data: gs }] = await Promise.all([
    db.from("projects").select("*, customer:customers(name)").in("status", show).order("no", { ascending: false }),
    db.from("guarantees").select("amount, currency, expires_on").eq("status", "active"),
  ]);
  const ps = projects ?? [];
  const sum = await summarize(db, ps);
  const by = (cur: string, f: (id: string) => number) => ps.filter((p) => p.currency === cur).reduce((a, p) => a + f(p.id), 0);
  const curs = [...new Set(ps.map((p) => p.currency))].sort();
  const multi = (f: (id: string) => number) => (curs.length ? curs.map((c) => money(by(c, f), c)).join(" + ") : "—");
  const expiring = (gs ?? []).filter((g) => g.expires_on && g.expires_on <= soon);
  return (
    <>
      <Alert error={sp.error} ok={sp.ok} />
      <div className="bar">
        <h2>المشاريع</h2>
        <div className="row noprint">
          <Link className="btn ghost sm" href={sp.all ? "/projects" : "/projects?all=1"}>{sp.all ? "المفتوحة فقط" : "عرض الكل"}</Link>
          <Link className="btn" href="/projects/new">+ مشروع</Link>
        </div>
      </div>
      <div className="kpis">
        <div className="kpi"><span>قيمة العقود</span><b>{multi((id) => Number(ps.find((p) => p.id === id)!.contract_value))}</b></div>
        <div className="kpi"><span>مفوتر وما استلمناه</span><b>{multi((id) => sum.get(id)!.receivable)}</b></div>
        <div className="kpi"><span>المحتجز عند الزبائن</span><b>{multi((id) => sum.get(id)!.retention)}</b></div>
        <div className="kpi"><span>ضمانات تنتهي خلال 30 يوم</span><b className={expiring.length ? "neg" : ""}>{expiring.length}</b><Link className="meta" href="/projects/guarantees">من {gs?.length ?? 0} سارية</Link></div>
      </div>
      {ps.length ? (
        <div className="tbl">
          <table>
            <thead><tr><th>#</th><th>المشروع</th><th>الزبون</th><th className="n">قيمة العقد</th><th>الإنجاز الفعلي · المفوتر</th><th className="n">المستحق</th><th className="n">الربح لحد الآن</th><th>الحالة</th></tr></thead>
            <tbody>
              {ps.map((p) => {
                const s = sum.get(p.id)!;
                const billed = Number(p.contract_value) > 0 ? Math.round((s.invoicedGross / Number(p.contract_value)) * 100) : 0;
                const profit = s.invoicedGross - s.cost - s.fees;
                const late = p.end_date && p.end_date < t && p.status === "active";
                return (
                  <tr key={p.id}>
                    <td className="num">{p.no}</td>
                    <td><Link href={`/projects/${p.id}`}><b>{p.name}</b></Link>{p.contract_no ? <div className="meta num">عقد {p.contract_no}</div> : null}</td>
                    <td>{(p.customer as { name: string } | null)?.name}</td>
                    <td className="n num">{money(p.contract_value, p.currency)}</td>
                    <td style={{ minWidth: 170 }}>
                      <div className="prog" title={`الإنجاز ${s.progress}%`}><i style={{ width: `${s.progress}%` }} /></div>
                      <div className="prog" title={`المفوتر ${billed}%`} style={{ marginTop: 3 }}><i style={{ width: `${Math.min(100, billed)}%`, background: "var(--info)" }} /></div>
                      <div className="meta num">{s.progress}% منجز · {billed}% مفوتر</div>
                    </td>
                    <td className="n num">{s.receivable > 0 ? money(s.receivable, p.currency) : "—"}</td>
                    <td className={`n num${profit < 0 ? " neg" : ""}`}>{money(profit, p.currency)}</td>
                    <td><span className={`pill tone-${late ? "bad" : PROJECT_STATUS[p.status]?.tone}`}>{late ? "متأخر" : PROJECT_STATUS[p.status]?.label}</span>{p.end_date ? <div className="meta num">{p.end_date}</div> : null}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : <div className="empty">ما اكو مشاريع. المشروع يجمع أكثر من أمر عمل تحت عقد واحد، بدفعات حسب الإنجاز.</div>}
      <p className="meta">الشريط الأخضر الإنجاز الفعلي بالوزن، والأزرق نسبة الدفعات المفوترة من العقد. إذا الأخضر سابق الأزرق، اكو دفعات تستحق الفوترة.</p>
    </>
  );
}
