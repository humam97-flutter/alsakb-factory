import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert, Pill, type IdPageProps } from "@/components/ui";
import { can, requireRole } from "@/lib/auth";
import { DOC_KIND, DOC_STATUS, fileSize, money, today } from "@/lib/labels";
import { supabase } from "@/lib/supabase/server";
import { deleteFile, setDocumentStatus } from "../actions";
import { Upload } from "./upload";

export default async function DocumentPage({ params, searchParams }: IdPageProps) {
  await requireRole(can.docs);
  const { id } = await params;
  const { error, ok } = await searchParams;
  const db = await supabase();
  const [{ data: d }, { data: files }, { data: replies }] = await Promise.all([
    db
      .from("documents")
      .select("*, parent:documents!reply_to(id, ref_no, subject), order:work_orders(id, no, product)")
      .eq("id", id)
      .maybeSingle(),
    db.from("document_files").select("*").eq("document_id", id).order("created_at"),
    db.from("documents").select("id, ref_no, doc_date, subject, kind").eq("reply_to", id).order("doc_date"),
  ]);
  if (!d) notFound();
  const parent = d.parent as { id: string; ref_no: string; subject: string } | null;
  const order = d.order as { id: string; no: number; product: string } | null;
  const t = today();
  const expired = d.expires_on && d.expires_on < t;
  const overdue = d.status === "pending" && d.due_date && d.due_date < t;

  const info: [string, React.ReactNode][] = [
    ["الرقم", <span className="num" key="n">{d.ref_no}</span>],
    ["التاريخ", <span className="num" key="d">{d.doc_date}</span>],
    ["الجهة", d.party],
    ["موعد الرد أو الإجراء", d.due_date && <span className={`num ${overdue ? "tone-bad" : ""}`} key="due">{d.due_date}{overdue ? " (متأخر)" : ""}</span>],
    ["يبدأ من", d.starts_on && <span className="num" key="s">{d.starts_on}</span>],
    ["ينتهي في", d.expires_on && <span className={`num ${expired ? "tone-bad" : ""}`} key="e">{d.expires_on}{expired ? " (منتهي)" : ""}</span>],
    ["المبلغ", d.amount != null && money(d.amount, d.currency)],
    ["ردّاً على", parent && <Link key="p" href={`/documents/${parent.id}`}>{parent.ref_no} · {parent.subject}</Link>],
    ["أمر العمل", order && <Link key="o" href={`/orders/${order.id}`}>#{order.no} · {order.product}</Link>],
  ];

  return (
    <>
      <Alert error={error} ok={ok} />
      <div className="bar">
        <h2>{d.subject}</h2>
        <Pill map={DOC_KIND} value={d.kind} />
        <Link className="btn ghost" href={`/documents/${d.id}/edit`}>تعديل</Link>
        {d.kind === "incoming" && (
          <Link className="btn ghost" href={`/documents/new?kind=outgoing&reply_to=${d.id}`}>+ كتاب رد</Link>
        )}
      </div>

      <form action={setDocumentStatus} className="seg" role="group" aria-label="الحالة" style={{ marginBottom: 10 }}>
        <input type="hidden" name="id" value={d.id} />
        {Object.entries(DOC_STATUS).map(([k, v]) => (
          <button key={k} type="submit" name="status" value={k} className={`tone-${v.tone}`} aria-pressed={d.status === k}>
            {v.label}
          </button>
        ))}
      </form>

      <div className="panel kv">
        {info
          .filter(([, v]) => v)
          .map(([l, v]) => (
            <div key={l}>
              <span>{l}</span>
              <b style={{ fontWeight: 500 }}>{v}</b>
            </div>
          ))}
      </div>
      {d.summary && (
        <div className="panel" style={{ marginTop: 10, whiteSpace: "pre-wrap" }}>
          {d.summary}
        </div>
      )}

      <h3 className="sec">الملفات</h3>
      <div className="panel">
        <Upload documentId={d.id} />
        {files?.length ? (
          <ul className="stages" style={{ marginTop: 10 }}>
            {files.map((f) => (
              <li key={f.id}>
                <a className="name" href={`/documents/file/${f.id}`} target="_blank" rel="noopener">
                  {f.name}
                </a>
                <span className="meta num">{fileSize(f.size)}</span>
                <a className="btn ghost sm" href={`/documents/file/${f.id}?download=1`}>تنزيل</a>
                <form action={deleteFile}>
                  <input type="hidden" name="id" value={f.id} />
                  <input type="hidden" name="document_id" value={d.id} />
                  <button className="btn ghost sm" type="submit" aria-label={`حذف ${f.name}`}>×</button>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <p className="meta" style={{ marginBottom: 0 }}>ما بيه ملفات بعد. ارفع صورة الكتاب أو نسخة PDF.</p>
        )}
      </div>

      {replies && replies.length > 0 && (
        <>
          <h3 className="sec">الردود والكتب المرتبطة</h3>
          <div className="tbl">
            <table>
              <thead><tr><th>الرقم</th><th>التاريخ</th><th>النوع</th><th>الموضوع</th></tr></thead>
              <tbody>
                {replies.map((r) => (
                  <tr key={r.id}>
                    <td className="num"><Link href={`/documents/${r.id}`}>{r.ref_no}</Link></td>
                    <td className="num">{r.doc_date}</td>
                    <td><Pill map={DOC_KIND} value={r.kind} /></td>
                    <td>{r.subject}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
