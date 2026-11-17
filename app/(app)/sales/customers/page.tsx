import Link from "next/link";
import { Alert, type PageProps } from "@/components/ui";
import { money } from "@/lib/labels";
import { supabase } from "@/lib/supabase/server";

export default async function CustomersPage({ searchParams }: PageProps) {
  const { q, error, debt } = await searchParams;
  const db = await supabase();
  let query = db.from("customers").select("id, name, phone, active").order("name");
  const term = (q ?? "").replace(/[,()%*\\]/g, " ").trim();
  if (term) query = query.or(`name.ilike.%${term}%,phone.ilike.%${term}%`);
  const [{ data: customers }, { data: balances }] = await Promise.all([query, db.from("customer_balances").select("*")]);
  const bal = new Map<string, { IQD: number; USD: number }>();
  for (const b of balances ?? []) {
    const x = bal.get(b.customer_id) ?? { IQD: 0, USD: 0 };
    x[b.currency as "IQD" | "USD"] = Number(b.balance);
    bal.set(b.customer_id, x);
  }
  let list = customers ?? [];
  if (debt) list = list.filter((c) => (bal.get(c.id)?.IQD ?? 0) > 0 || (bal.get(c.id)?.USD ?? 0) > 0);
  const totIqd = [...bal.values()].reduce((a, b) => a + Math.max(0, b.IQD), 0);
  const totUsd = [...bal.values()].reduce((a, b) => a + Math.max(0, b.USD), 0);

  return (
    <>
      <Alert error={error} />
      <form className="bar" method="get">
        <h2>الزبائن</h2>
        <input name="q" type="search" placeholder="بحث بالاسم أو الهاتف" defaultValue={q} aria-label="بحث" />
        <label className="row" style={{ fontSize: 13 }}>
          <input type="checkbox" name="debt" value="1" defaultChecked={!!debt} style={{ width: "auto" }} /> عليهم ديون بس
        </label>
        <button className="btn ghost" type="submit">عرض</button>
        <Link className="btn" href="/sales/customers/new">+ زبون</Link>
      </form>
      <div className="kpis">
        <div className="kpi"><b className={totIqd ? "tone-warn" : ""}>{money(totIqd)}</b><span>مجموع الديون بالدينار</span></div>
        {totUsd > 0 && <div className="kpi"><b className="tone-warn">{money(totUsd, "USD")}</b><span>مجموع الديون بالدولار</span></div>}
      </div>
      {!list.length ? (
        <div className="empty">ما بيه زبائن هنا.</div>
      ) : (
        <div className="tbl" style={{ marginTop: 12 }}>
          <table>
            <thead><tr><th>الزبون</th><th>الهاتف</th><th className="n">الباقي (دينار)</th><th className="n">الباقي (دولار)</th></tr></thead>
            <tbody>
              {list.map((c) => {
                const b = bal.get(c.id);
                return (
                  <tr key={c.id} style={c.active ? undefined : { opacity: 0.6 }}>
                    <td><Link href={`/sales/customers/${c.id}`}>{c.name}</Link></td>
                    <td className="num">{c.phone}</td>
                    <td className={`n num ${(b?.IQD ?? 0) > 0 ? "neg" : ""}`}>{b?.IQD ? money(b.IQD) : "—"}</td>
                    <td className={`n num ${(b?.USD ?? 0) > 0 ? "neg" : ""}`}>{b?.USD ? money(b.USD, "USD") : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
