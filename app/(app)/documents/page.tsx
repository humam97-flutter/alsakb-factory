import { cut, Pager, paging } from "@/components/pager";
import Link from "next/link";
import { Alert, Pill, type PageProps } from "@/components/ui";
import { can, requireRole } from "@/lib/auth";
import { addDays, DOC_KIND, DOC_STATUS, today } from "@/lib/labels";
import { supabase } from "@/lib/supabase/server";

export default async function DocumentsPage({ searchParams }: PageProps) {
  await requireRole(can.docs);
  const __sp = await searchParams;
  const { kind, status, q, error } = __sp;
  const pg = paging(__sp);
  const db = await supabase();
  const t = today();
  const soon = addDays(t, 30);

  let query = db
    .from("documents")
    .select("id, kind, ref_no, doc_date, subject, party, status, due_date, expires_on, files:document_files(count)")
    .order("doc_date", { ascending: false })
    .order("serial", { ascending: false })
    .range(pg.from, pg.to);
  if (kind) query = query.eq("kind", kind);
  if (status) query = query.eq("status", status);
  else query = query.neq("status", "archived");
  const term = (q ?? "").replace(/[,()%*\\]/g, " ").trim();
  if (term) query = query.or(`subject.ilike.%${term}%,party.ilike.%${term}%,ref_no.ilike.%${term}%,summary.ilike.%${term}%`);

  const [{ data: docsAll }, { data: attention }] = await Promise.all([
    query,
    db
      .from("documents")
      .select("id, kind, ref_no, subject, due_date, expires_on, status")
      .neq("status", "archived")
      .or(`and(status.eq.pending,due_date.lte.${soon}),expires_on.lte.${soon}`)
      .order("due_date", { ascending: true, nullsFirst: false }),
  ]);
  const { rows: docs, more } = cut(docsAll);

  const tabs = [["", "الكل"], ...Object.entries(DOC_KIND).map(([k, v]) => [k, v.label])];
  const href = (k: string) => {
    const p = new URLSearchParams();
    if (k) p.set("kind", k);
    if (status) p.set("status", status);
    if (q) p.set("q", q);
    const s = p.toString();
    return `/documents${s ? "?" + s : ""}`;
  };

  return (
    <>
      <Alert error={error} />
      <form className="bar" method="get">
        <h2>المستندات</h2>
        {kind && <input type="hidden" name="kind" value={kind} />}
        <input name="q" type="search" placeholder="بحث بالموضوع أو الجهة أو الرقم" defaultValue={q} aria-label="بحث" />
        <select name="status" defaultValue={status ?? ""} aria-label="الحالة">
          <option value="">غير المؤرشفة</option>
          {Object.entries(DOC_STATUS).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        <button className="btn ghost" type="submit">عرض</button>
        <Link className="btn" href={`/documents/new${kind ? "?kind=" + kind : ""}`}>+ مستند</Link>
        <a className="btn ghost sm" href="/export/documents">Excel</a>
      </form>

      <nav className="seg" aria-label="النوع" style={{ marginBottom: 12 }}>
        {tabs.map(([k, l]) => (
          <Link key={k} href={href(k)} aria-current={(kind ?? "") === k ? "page" : undefined}
            style={{ padding: "5px 12px", fontSize: 13, textDecoration: "none", fontWeight: (kind ?? "") === k ? 700 : 400 }}>
            {l}
          </Link>
        ))}
      </nav>

      {attention && attention.length > 0 && (
        <div className="panel" style={{ marginBottom: 12 }}>
          <b>تحتاج انتباه</b>
          <ul style={{ margin: "6px 0 0", paddingInlineStart: 18 }}>
            {attention.map((a) => {
              const late = a.status === "pending" && a.due_date && a.due_date <= soon;
              const exp = a.expires_on && a.expires_on <= soon;
              const bad = (late && a.due_date! < t) || (exp && a.expires_on! < t);
              return (
                <li key={a.id} className={bad ? "tone-bad" : "tone-warn"} style={{ fontSize: 14 }}>
                  <Link href={`/documents/${a.id}`}>{a.ref_no} · {a.subject}</Link>
                  {" — "}
                  {late && (a.due_date! < t ? `متأخر الرد من ${a.due_date}` : `الرد مطلوب قبل ${a.due_date}`)}
                  {late && exp && "، "}
                  {exp && (a.expires_on! < t ? `انتهى في ${a.expires_on}` : `ينتهي في ${a.expires_on}`)}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {!docs?.length ? (
        <div className="empty">ما بيه مستندات هنا بعد.</div>
      ) : (
        <div className="tbl">
          <table>
            <thead>
              <tr><th>الرقم</th><th>التاريخ</th><th>النوع</th><th>الموضوع</th><th>الجهة</th><th>الحالة</th><th className="n">ملفات</th></tr>
            </thead>
            <tbody>
              {docs.map((d) => {
                const n = (d.files as unknown as { count: number }[])?.[0]?.count ?? 0;
                return (
                  <tr key={d.id}>
                    <td className="num"><Link href={`/documents/${d.id}`}>{d.ref_no}</Link></td>
                    <td className="num">{d.doc_date}</td>
                    <td><Pill map={DOC_KIND} value={d.kind} /></td>
                    <td style={{ whiteSpace: "normal", minWidth: 200 }}><Link href={`/documents/${d.id}`}>{d.subject}</Link></td>
                    <td>{d.party}</td>
                    <td><Pill map={DOC_STATUS} value={d.status} /></td>
                    <td className="n num">{n || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <Pager page={pg.page} more={more} sp={__sp} path="/documents" />
    </>
  );
}
