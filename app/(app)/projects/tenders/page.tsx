import Link from "next/link";
import { Alert, type PageProps } from "@/components/ui";
import { CURRENCIES, money, today } from "@/lib/labels";
import { TENDER_STATUS } from "@/lib/projects";
import { supabase } from "@/lib/supabase/server";
import { deleteTender, saveTender, setTenderResult } from "../actions";

// المناقصات: المواعيد، سعرنا مقابل الفائز، ونسبة الفوز
export default async function TendersPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const db = await supabase();
  const t = today();
  const [{ data: tenders }, { data: customers }, { data: estimates }] = await Promise.all([
    db.from("tenders").select("*, customer:customers(name), project:projects(id, no)").order("submit_due", { ascending: false, nullsFirst: true }),
    db.from("customers").select("id, name").eq("active", true).order("name"),
    db.from("estimates").select("id, no, title").order("no", { ascending: false }).limit(40),
  ]);
  const list = tenders ?? [];
  const decided = list.filter((x) => x.status === "won" || x.status === "lost");
  const won = decided.filter((x) => x.status === "won").length;
  const gaps = list.filter((x) => x.status === "lost" && x.our_price && x.winner_price).map((x) => (Number(x.our_price) - Number(x.winner_price)) / Number(x.winner_price) * 100);
  const avgGap = gaps.length ? Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length) : null;
  const upcoming = list.filter((x) => (x.status === "preparing") && x.submit_due && x.submit_due >= t);
  return (
    <>
      <Alert error={sp.error} ok={sp.ok} />
      <div className="bar"><h2>المناقصات</h2></div>
      <div className="kpis">
        <div className="kpi"><span>قيد التحضير</span><b>{upcoming.length}</b>{upcoming[0] ? <span className="meta">أقرب موعد {upcoming.sort((a, b) => String(a.submit_due).localeCompare(String(b.submit_due)))[0].submit_due}</span> : null}</div>
        <div className="kpi"><span>نسبة الفوز</span><b className="num">{decided.length ? `${Math.round((won / decided.length) * 100)}%` : "—"}</b><span className="meta num">{won} من {decided.length}</span></div>
        <div className="kpi"><span>فرق سعرنا عن الفائز (بالخسارة)</span><b className="num"><bdi className="ltr">{avgGap != null ? `${avgGap > 0 ? "+" : ""}${avgGap}%` : "—"}</bdi></b></div>
      </div>
      {list.length ? (
        <div className="tbl">
          <table>
            <thead><tr><th>#</th><th>المناقصة</th><th>آخر موعد</th><th className="n">سعرنا</th><th>النتيجة</th><th></th></tr></thead>
            <tbody>
              {list.map((x) => {
                const late = x.status === "preparing" && x.submit_due && x.submit_due < t;
                const pr = x.project as { id: string; no: number } | null;
                return (
                  <tr key={x.id}>
                    <td className="num">{x.no}</td>
                    <td><b>{x.title}</b><div className="meta">{[x.issuer, (x.customer as { name: string } | null)?.name, x.ref_no].filter(Boolean).join(" · ")}</div></td>
                    <td className="num">{x.submit_due ?? "—"}{late ? <div><span className="pill tone-bad">فات الموعد</span></div> : null}</td>
                    <td className="n num">{x.our_price ? money(x.our_price, x.currency) : "—"}{Number(x.bid_bond) ? <div className="meta">{`ضمان دخول ${money(x.bid_bond, x.currency)}`}</div> : null}</td>
                    <td>
                      <span className={`pill tone-${TENDER_STATUS[x.status]?.tone}`}>{TENDER_STATUS[x.status]?.label}</span>
                      {x.status === "lost" && x.winner ? <div className="meta">{x.winner}{x.winner_price ? ` · ${money(x.winner_price, x.currency)}` : ""}</div> : null}
                      {pr ? <div><Link className="meta" href={`/projects/${pr.id}`}>مشروع #{pr.no}</Link></div> : null}
                    </td>
                    <td>
                      <details>
                        <summary className="btn ghost sm">تحديث</summary>
                        <form action={setTenderResult} className="panel" style={{ marginTop: 6, minWidth: 260 }}>
                          <input type="hidden" name="id" value={x.id} />
                          <div className="fields">
                            <label>الحالة<select name="status" defaultValue={x.status}>{Object.entries(TENDER_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></label>
                            <label>الفائز<input name="winner" defaultValue={x.winner ?? ""} /></label>
                            <label>سعر الفائز<input name="winner_price" type="number" step="any" defaultValue={x.winner_price ?? ""} /></label>
                          </div>
                          <div className="actions"><button className="btn ghost sm" type="submit">حفظ</button></div>
                        </form>
                        {x.status === "won" && !pr && <Link className="btn sm" href={`/projects/new?tender=${x.id}`} style={{ marginTop: 6 }}>حوّلها لمشروع</Link>}
                        <form action={deleteTender} style={{ marginTop: 6 }}><input type="hidden" name="id" value={x.id} /><button className="btn ghost sm" type="submit">حذف</button></form>
                      </details>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : <div className="empty">ما اكو مناقصات مسجلة.</div>}

      <h3 className="sec">مناقصة جديدة</h3>
      <form action={saveTender} className="panel">
        <div className="fields">
          <label className="full">العنوان<input name="title" required placeholder="تجهيز ونصب خزانات وقود سعة 2000 م³" /></label>
          <label>الجهة المعلنة<input name="issuer" /></label>
          <label>الزبون<select name="customer_id" defaultValue=""><option value="">-</option>{(customers ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <label>رقم المناقصة<input name="ref_no" /></label>
          <label>تاريخ الإعلان<input name="published_on" type="date" /></label>
          <label>آخر موعد للتقديم<input name="submit_due" type="date" /></label>
          <label>مبلغ ضمان الدخول<input name="bid_bond" type="number" step="any" /></label>
          <label>ثمن الأوراق<input name="doc_fee" type="number" step="any" /></label>
          <label>التسعير التقديري<select name="estimate_id" defaultValue=""><option value="">-</option>{(estimates ?? []).map((e) => <option key={e.id} value={e.id}>#{e.no} {e.title}</option>)}</select></label>
          <label>سعرنا<input name="our_price" type="number" step="any" /></label>
          <label>العملة<select name="currency" defaultValue="IQD">{Object.entries(CURRENCIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <label className="full">ملاحظات<input name="notes" /></label>
        </div>
        <div className="actions"><button className="btn" type="submit">حفظ</button></div>
      </form>
    </>
  );
}
