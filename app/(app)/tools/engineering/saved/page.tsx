import Link from "next/link";
import { Alert, type PageProps } from "@/components/ui";
import { can, getMe } from "@/lib/auth";
import { num } from "@/lib/labels";
import { supabase } from "@/lib/supabase/server";
import { deleteCalc } from "../actions";

const PATH: Record<string, string> = { vessel: "/tools/engineering", tank: "/tools/engineering/tank" };
const KIND: Record<string, string> = { vessel: "وعاء ضغط", tank: "خزان API 650" };

export default async function SavedPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const me = await getMe();
  const db = await supabase();
  const { data } = await db.from("calcs").select("*, order:work_orders(id, no, product)").order("created_at", { ascending: false }).limit(300);
  const rows = data ?? [];
  return (
    <>
      <Alert error={sp.error} ok={sp.ok} />
      <div className="bar"><h2>الحسابات المحفوظة</h2></div>
      {!rows.length ? (
        <div className="empty">ما بيه حسابات محفوظة. احسب وعاء أو خزان واضغط «حفظ».</div>
      ) : (
        <div className="tbl">
          <table>
            <thead><tr><th>التاريخ</th><th>النوع</th><th>الحساب</th><th>أمر العمل</th><th>الخلاصة</th><th></th></tr></thead>
            <tbody>
              {rows.map((c) => {
                const o = c.order as { id: string; no: number; product: string } | null;
                const r = c.results as Record<string, number | number[]>;
                const sum =
                  c.kind === "vessel"
                    ? `جسم ${r.tShell} · رأس ${r.tHead} ملم · ${num(Math.round(Number(r.liters)))} لتر · ${num(Math.round(Number(r.emptyKg)))} كغم`
                    : c.kind === "tank"
                      ? `حلقات ${(r.courses as number[] | undefined)?.join("/")} ملم · ${num(Math.round(Number(r.nominal) / 1000))} م³`
                      : "";
                return (
                  <tr key={c.id}>
                    <td className="num">{new Date(c.created_at).toLocaleDateString("en-CA")}</td>
                    <td>{KIND[c.kind] ?? c.kind}</td>
                    <td><Link href={`${PATH[c.kind] ?? "/tools/engineering"}?${new URLSearchParams(c.inputs as Record<string, string>).toString()}`}>{c.title}</Link></td>
                    <td>{o ? <Link href={`/orders/${o.id}`}>#{o.no} {o.product}</Link> : ""}</td>
                    <td className="meta">{sum}</td>
                    <td>
                      <div className="row" style={{ gap: 4 }}>
                      {can.finance(me.role) && (c.kind === "vessel" || c.kind === "tank") && (
                        <Link className="btn ghost sm" href={`/sales/estimates/new?calc=${c.id}&title=${encodeURIComponent(c.title)}`}>سعّره</Link>
                      )}
                      {can.production(me.role) && (
                        <form action={deleteCalc}>
                          <input type="hidden" name="id" value={c.id} />
                          <button className="btn ghost sm" type="submit" aria-label="حذف">×</button>
                        </form>
                      )}
                      </div>
                    </td>
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
