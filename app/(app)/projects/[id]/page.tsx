import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert, type IdPageProps } from "@/components/ui";
import { CURRENCIES, money, num, today } from "@/lib/labels";
import { summarize } from "@/lib/project-summary";
import { GUARANTEE_KIND, GUARANTEE_STATUS, MILESTONE_KIND, milestoneLines, milestoneState, MS_STATE, PROJECT_STATUS, retentionHeld } from "@/lib/projects";
import { supabase } from "@/lib/supabase/server";
import { deleteGuarantee, deleteMilestone, deleteProject, invoiceMilestone, linkOrder, saveGuarantee, saveMilestone, saveProject, setGuaranteeStatus } from "../actions";
import { ProjectFields } from "../form";

// صفحة المشروع: الأوامر، جدول الدفعات، الضمانات، والربحية
export default async function ProjectPage({ params, searchParams }: IdPageProps) {
  const { id } = await params;
  const sp = await searchParams;
  const db = await supabase();
  const t = today();
  const [{ data: p }, { data: orders }, { data: ms }, { data: gs }, { data: customers }, { data: freeOrders }] = await Promise.all([
    db.from("projects").select("*, customer:customers(name)").eq("id", id).maybeSingle(),
    db.from("work_orders").select("id, no, product, weight_kg, due_date, status").eq("project_id", id).order("no"),
    db.from("project_milestones").select("*").eq("project_id", id).order("position"),
    db.from("guarantees").select("*").eq("project_id", id).order("expires_on"),
    db.from("customers").select("id, name").eq("active", true).order("name"),
    db.from("work_orders").select("id, no, product").is("project_id", null).in("status", ["new", "in_progress", "on_hold"]).order("no", { ascending: false }).limit(60),
  ]);
  if (!p) notFound();
  const s = (await summarize(db, [p])).get(p.id)!;
  const cur = p.currency;
  const cv = Number(p.contract_value);
  const mss = ms ?? [];
  const invIds = mss.map((m) => m.invoice_id).filter(Boolean) as string[];
  const orderIds = (orders ?? []).map((o) => o.id);
  const [{ data: tots }, { data: costs }] = await Promise.all([
    invIds.length ? db.from("invoice_totals").select("invoice_id, total, balance").in("invoice_id", invIds) : Promise.resolve({ data: [] as { invoice_id: string; total: number; balance: number }[] }),
    orderIds.length ? db.from("work_order_costs").select("order_id, cost_total").in("order_id", orderIds) : Promise.resolve({ data: [] as { order_id: string; cost_total: number }[] }),
  ]);
  const tot = new Map((tots ?? []).map((x) => [x.invoice_id, x]));
  const costOf = new Map((costs ?? []).map((c) => [c.order_id, Number(c.cost_total)]));
  const oName = new Map((orders ?? []).map((o) => [o.id, `#${o.no}`]));
  const held = retentionHeld(p, mss);
  const billed = cv > 0 ? Math.round((s.invoicedGross / cv) * 100) : 0;
  const projCost = s.progress > 5 ? (s.cost / s.progress) * 100 : null;
  const projProfit = projCost != null ? cv - projCost - s.fees : null;
  const pctSum = mss.filter((m) => m.kind === "progress" || m.kind === "delivery").reduce((a, m) => a + Number(m.pct), 0);
  const back = `/projects/${id}`;
  const states = mss.map((m) => milestoneState(m, m.invoice_id ? tot.get(m.invoice_id) : undefined, m.order_id ? s.orderProgress.get(m.order_id) : s.progress, t));
  const dueCount = states.filter((x) => x === "due" || x === "overdue").length;

  return (
    <>
      <Alert error={sp.error} ok={sp.ok} />
      <div className="bar">
        <h2>مشروع #{p.no} · {p.name}</h2>
        <span className={`pill tone-${PROJECT_STATUS[p.status]?.tone}`}>{PROJECT_STATUS[p.status]?.label}</span>
      </div>
      <p className="meta">
        {(p.customer as { name: string } | null)?.name}{p.contract_no ? ` · عقد ${p.contract_no}` : ""}{p.start_date ? ` · ${p.start_date} ← ${p.end_date ?? ""}` : ""}{p.manager ? ` · ${p.manager}` : ""}
      </p>
      <div className="kpis">
        <div className="kpi"><span>قيمة العقد</span><b>{money(cv, cur)}</b></div>
        <div className="kpi">
          <span>الإنجاز الفعلي · المفوتر</span><b className="num">{s.progress}% · {billed}%</b>
          <div className="prog" style={{ marginTop: 6 }}><i style={{ width: `${s.progress}%` }} /></div>
          <div className="prog" style={{ marginTop: 3 }}><i style={{ width: `${Math.min(100, billed)}%`, background: "var(--info)" }} /></div>
        </div>
        <div className="kpi"><span>مستلم · باقي على الفواتير</span><b>{money(s.paid, cur)}</b><span className="meta">{s.receivable > 0 ? `باقي ${money(s.receivable, cur)}` : "ما اكو مستحق"}</span></div>
        <div className="kpi"><span>المحتجز · السلفة غير المستردة</span><b>{money(held, cur)}</b><span className="meta">{s.advance > 0 ? `سلفة ${money(s.advance, cur)}` : ""}</span></div>
      </div>

      <h3 className="sec">الربحية</h3>
      <div className="tbl">
        <table data-plain>
          <tbody>
            <tr><th>الإيراد المكتسب (دفعات الإنجاز المفوترة قبل الطرح)</th><td className="num">{money(s.invoicedGross, cur)}</td><th>الكلفة لحد الآن (مواد، عمال، مكائن، أخرى)</th><td className="num">{money(s.cost, cur)}</td></tr>
            <tr><th>عمولات خطابات الضمان</th><td className="num">{money(s.fees, cur)}</td><th>الربح لحد الآن</th><td className={`num${s.invoicedGross - s.cost - s.fees < 0 ? " neg" : ""}`}><b>{money(s.invoicedGross - s.cost - s.fees, cur)}</b></td></tr>
            <tr>
              <th>الكلفة المتوقعة عند الإنجاز (الكلفة ÷ الإنجاز)</th><td className="num">{projCost != null ? money(projCost, cur) : "—"}</td>
              <th>الربح المتوقع للمشروع</th>
              <td className={`num${projProfit != null && projProfit < 0 ? " neg" : ""}`}>{projProfit != null ? <>{money(projProfit, cur)} <span className="meta">({cv ? Math.round((projProfit / cv) * 100) : 0}%)</span></> : <span className="meta">يظهر بعد ما يبدي الشغل</span>}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h3 className="sec" id="orders">أوامر العمل</h3>
      {orders?.length ? (
        <div className="tbl">
          <table data-plain>
            <thead><tr><th>الأمر</th><th className="n">الوزن</th><th>الإنجاز</th><th className="n">الكلفة لحد الآن</th><th>التسليم</th><th></th></tr></thead>
            <tbody>
              {orders.map((o) => {
                const pr = s.orderProgress.get(o.id) ?? 0;
                return (
                  <tr key={o.id}>
                    <td><Link href={`/orders/${o.id}`}><b className="num">#{o.no}</b> {o.product}</Link></td>
                    <td className="n num">{o.weight_kg ? `${num(Number(o.weight_kg))} كغم` : "—"}</td>
                    <td style={{ minWidth: 140 }}><div className="row" style={{ gap: 6, flexWrap: "nowrap" }}><div className="prog" style={{ flex: 1 }}><i style={{ width: `${pr}%` }} /></div><span className="num">{pr}%</span></div></td>
                    <td className="n num">{money(costOf.get(o.id) ?? 0, cur)}</td>
                    <td className="num">{o.due_date ?? ""} <Link className="meta" href={`/production/plan/${o.id}`}>الخطة</Link></td>
                    <td>
                      <form action={linkOrder}><input type="hidden" name="project_id" value={id} /><input type="hidden" name="order_id" value={o.id} /><input type="hidden" name="unlink" value="yes" /><button className="btn ghost sm" type="submit" title="فك الربط" aria-label="فك الربط">×</button></form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : <p className="meta">ما اكو أوامر مربوطة بالمشروع.</p>}
      {freeOrders?.length ? (
        <form action={linkOrder} className="row noprint" style={{ marginTop: 8 }}>
          <input type="hidden" name="project_id" value={id} />
          <select name="order_id" aria-label="الأمر" style={{ width: 260 }}><option value="">ربط أمر عمل موجود…</option>{freeOrders.map((o) => <option key={o.id} value={o.id}>#{o.no} {o.product}</option>)}</select>
          <button className="btn ghost" type="submit">ربط</button>
          <Link className="btn ghost" href="/orders/new">+ أمر جديد</Link>
        </form>
      ) : null}

      <h3 className="sec" id="milestones">جدول الدفعات {dueCount > 0 && <span className="pill tone-warn">{dueCount} تستحق الفوترة</span>}</h3>
      {pctSum !== 100 && mss.length > 0 && <p className="meta"><span className="pill tone-warn">مجموع دفعات الإنجاز {num(pctSum)}%</span> المفروض يكون 100% من قيمة العقد. السلفة خارج هالمجموع لأنها تنسترد من الدفعات.</p>}
      {mss.length ? (
        <div className="tbl">
          <table data-plain>
            <thead><tr><th>#</th><th>الدفعة</th><th className="n">النسبة</th><th className="n">المبلغ · الصافي بعد الطرح</th><th>تستحق عند</th><th>الحالة</th><th></th></tr></thead>
            <tbody>
              {mss.map((m, i) => {
                const lines = milestoneLines(p, m, held, m.name);
                const gross = lines[0]?.amount ?? 0;
                const net = lines.reduce((a, l) => a + l.amount, 0);
                const st = states[i];
                return (
                  <tr key={m.id}>
                    <td className="num">{m.position}</td>
                    <td>{m.name}<div className="meta">{MILESTONE_KIND[m.kind]}</div></td>
                    <td className="n num">{m.kind === "retention" ? `${num(Number(p.retention_pct))}%` : `${num(Number(m.pct))}%`}</td>
                    <td className="n num">{m.status === "pending" ? <>{money(gross, cur)}{net !== gross ? <div className="meta">{`صافي ${money(net, cur)}`}</div> : null}</> : m.invoice_id ? <>{money(tot.get(m.invoice_id)?.total, cur)}</> : "—"}</td>
                    <td className="meta">
                      {m.trigger_progress != null ? <>إنجاز {m.order_id ? oName.get(m.order_id) ?? "الأمر" : "المشروع"} <span className="num">{m.trigger_progress}%</span></> : null}
                      {m.due_date ? <div className="num">{m.due_date}</div> : null}
                    </td>
                    <td><span className={`pill tone-${MS_STATE[st]?.tone}`}>{MS_STATE[st]?.label}</span></td>
                    <td>
                      {m.status === "pending" ? (
                        <div className="row" style={{ gap: 4, flexWrap: "nowrap" }}>
                          <form action={invoiceMilestone}><input type="hidden" name="project_id" value={id} /><input type="hidden" name="id" value={m.id} /><button className={`btn sm${st === "due" || st === "overdue" ? "" : " ghost"}`} type="submit">فوترها</button></form>
                          <form action={deleteMilestone}><input type="hidden" name="project_id" value={id} /><input type="hidden" name="id" value={m.id} /><button className="btn ghost sm" type="submit" aria-label="حذف">×</button></form>
                        </div>
                      ) : m.invoice_id ? <Link className="btn ghost sm" href={`/sales/invoices/${m.invoice_id}`}>الفاتورة</Link> : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : <p className="meta">ما اكو دفعات. ضيف جدول الدفعات حسب العقد.</p>}
      <details className="noprint" style={{ marginTop: 10 }}>
        <summary className="btn ghost">+ دفعة</summary>
        <form action={saveMilestone} className="panel" style={{ marginTop: 8 }}>
          <input type="hidden" name="project_id" value={id} />
          <div className="fields">
            <label className="full">الوصف<input name="name" required placeholder="عند إنجاز 50% من التصنيع" /></label>
            <label>النوع<select name="kind" defaultValue="progress">{Object.entries(MILESTONE_KIND).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
            <label>النسبة من العقد %<input name="pct" type="number" step="any" /></label>
            <label>مربوطة بأمر<select name="order_id" defaultValue=""><option value="">المشروع كله</option>{(orders ?? []).map((o) => <option key={o.id} value={o.id}>#{o.no} {o.product}</option>)}</select></label>
            <label>تستحق عند إنجاز %<input name="trigger_progress" type="number" min={0} max={100} /></label>
            <label>أو بتاريخ<input name="due_date" type="date" /></label>
          </div>
          <div className="actions"><button className="btn ghost" type="submit">إضافة</button></div>
        </form>
      </details>

      <h3 className="sec">خطابات الضمان</h3>
      {gs?.length ? (
        <ul className="stages panel">
          {gs.map((g) => (
            <li key={g.id}>
              <span className="name">{GUARANTEE_KIND[g.kind]} · {g.bank}{g.ref_no ? <span className="meta num"> {g.ref_no}</span> : null}</span>
              <span className="num">{money(g.amount, g.currency)}</span>
              <span className="meta num">لحد {g.expires_on ?? "—"}</span>
              <span className={`pill tone-${g.status === "active" && g.expires_on && g.expires_on < t ? "bad" : GUARANTEE_STATUS[g.status]?.tone}`}>{g.status === "active" && g.expires_on && g.expires_on < t ? "منتهي" : GUARANTEE_STATUS[g.status]?.label}</span>
              {g.status === "active" && <form action={setGuaranteeStatus}><input type="hidden" name="id" value={g.id} /><input type="hidden" name="status" value="released" /><input type="hidden" name="back" value={back} /><button className="btn ghost sm" type="submit">استرداد</button></form>}
              <form action={deleteGuarantee}><input type="hidden" name="id" value={g.id} /><input type="hidden" name="back" value={back} /><button className="btn ghost sm" type="submit" aria-label="حذف">×</button></form>
            </li>
          ))}
        </ul>
      ) : <p className="meta">ما اكو خطابات ضمان على هذا المشروع.</p>}
      <details className="noprint" style={{ marginTop: 10 }}>
        <summary className="btn ghost">+ خطاب ضمان</summary>
        <form action={saveGuarantee} className="panel" style={{ marginTop: 8 }}>
          <input type="hidden" name="project_id" value={id} />
          <input type="hidden" name="customer_id" value={p.customer_id ?? ""} />
          <input type="hidden" name="back" value={back} />
          <div className="fields">
            <label>النوع<select name="kind" defaultValue="performance">{Object.entries(GUARANTEE_KIND).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
            <label>المصرف<input name="bank" /></label>
            <label>رقم الخطاب<input name="ref_no" /></label>
            <label>المبلغ<input name="amount" type="number" step="any" defaultValue={Math.round(cv * 0.05)} /></label>
            <label>العملة<select name="currency" defaultValue={cur}>{Object.entries(CURRENCIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
            <label>تاريخ الإصدار<input name="issued_on" type="date" defaultValue={t} /></label>
            <label>تاريخ الانتهاء<input name="expires_on" type="date" defaultValue={p.end_date ?? ""} /></label>
            <label>عمولة المصرف<input name="fee" type="number" step="any" /></label>
            <label>التأمينات النقدية<input name="cash_margin" type="number" step="any" /></label>
          </div>
          <div className="actions"><button className="btn ghost" type="submit">حفظ</button></div>
        </form>
      </details>

      <h3 className="sec">تعديل المشروع</h3>
      <details className="noprint">
        <summary className="btn ghost">تعديل معلومات المشروع</summary>
        <form action={saveProject} className="panel" style={{ marginTop: 8 }}>
          <ProjectFields p={p} customers={customers ?? []} />
          <div className="actions"><button className="btn" type="submit">حفظ</button></div>
        </form>
        <form action={deleteProject} className="row" style={{ marginTop: 10 }}>
          <input type="hidden" name="id" value={id} />
          <label className="row" style={{ gap: 6 }}><input type="checkbox" name="confirm" value="yes" style={{ width: "auto" }} /> <span className="meta">أكد حذف المشروع (الأوامر والفواتير تبقى)</span></label>
          <button className="btn ghost sm" type="submit">حذف المشروع</button>
        </form>
      </details>
    </>
  );
}
