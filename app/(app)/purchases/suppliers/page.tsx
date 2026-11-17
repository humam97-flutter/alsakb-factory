import Link from "next/link";
import { Alert, type PageProps } from "@/components/ui";
import { can, getMe } from "@/lib/auth";
import { money } from "@/lib/labels";
import { supabase } from "@/lib/supabase/server";

export default async function SuppliersPage({ searchParams }: PageProps) {
  const { q, error } = await searchParams;
  const me = await getMe();
  const fin = can.finance(me.role);
  const db = await supabase();
  let query = db.from("suppliers").select("id, name, phone, supplies, active").order("name");
  const term = (q ?? "").replace(/[,()%*\\]/g, " ").trim();
  if (term) query = query.or(`name.ilike.%${term}%,supplies.ilike.%${term}%,phone.ilike.%${term}%`);
  const [{ data: suppliers }, { data: balances }] = await Promise.all([
    query,
    fin ? db.from("supplier_balances").select("*") : Promise.resolve({ data: [] as { supplier_id: string; currency: string; balance: number }[] }),
  ]);
  const bal = new Map<string, Record<string, number>>();
  for (const b of balances ?? []) bal.set(b.supplier_id, { ...(bal.get(b.supplier_id) ?? {}), [b.currency]: Number(b.balance) });
  const owe = (cur: string) => [...bal.values()].reduce((a, b) => a + Math.max(0, b[cur] ?? 0), 0);
  const edit = can.finance(me.role) || can.stock(me.role);

  return (
    <>
      <Alert error={error} />
      <form className="bar" method="get">
        <h2>الموردين</h2>
        <input name="q" type="search" placeholder="بحث بالاسم أو شنو يجهّز" defaultValue={q} aria-label="بحث" />
        <button className="btn ghost" type="submit">عرض</button>
        {edit && <Link className="btn" href="/purchases/suppliers/new">+ مورد</Link>}
      </form>
      {fin && (
        <div className="kpis">
          <div className="kpi"><b className={owe("IQD") ? "tone-warn" : ""}>{money(owe("IQD"))}</b><span>علينا للموردين بالدينار</span></div>
          {owe("USD") > 0 && <div className="kpi"><b className="tone-warn">{money(owe("USD"), "USD")}</b><span>بالدولار</span></div>}
        </div>
      )}
      {!suppliers?.length ? (
        <div className="empty">ما بيه موردين بعد.</div>
      ) : (
        <div className="tbl" style={{ marginTop: 12 }}>
          <table>
            <thead><tr><th>المورد</th><th>يجهّز</th><th>الهاتف</th>{fin && <><th className="n">علينا (دينار)</th><th className="n">علينا (دولار)</th></>}</tr></thead>
            <tbody>
              {suppliers.map((s) => {
                const b = bal.get(s.id);
                return (
                  <tr key={s.id} style={s.active ? undefined : { opacity: 0.6 }}>
                    <td><Link href={`/purchases/suppliers/${s.id}`}>{s.name}</Link></td>
                    <td>{s.supplies}</td>
                    <td className="num">{s.phone}</td>
                    {fin && (
                      <>
                        <td className={`n num ${(b?.IQD ?? 0) > 0 ? "neg" : ""}`}>{b?.IQD ? money(b.IQD) : "—"}</td>
                        <td className={`n num ${(b?.USD ?? 0) > 0 ? "neg" : ""}`}>{b?.USD ? money(b.USD, "USD") : "—"}</td>
                      </>
                    )}
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
