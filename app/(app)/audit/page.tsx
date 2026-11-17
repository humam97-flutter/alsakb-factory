import { cut, Pager, paging } from "@/components/pager";
import Link from "next/link";
import { Alert, type PageProps } from "@/components/ui";
import { can, requireRole } from "@/lib/auth";
import { supabase } from "@/lib/supabase/server";

const TABLES: Record<string, { label: string; href?: (id: string) => string }> = {
  work_orders: { label: "أمر عمل", href: (id) => `/orders/${id}` },
  work_order_finance: { label: "أسعار أمر", href: (id) => `/orders/${id}` },
  materials: { label: "مادة", href: (id) => `/stock/${id}` },
  stock_moves: { label: "حركة مخزن" },
  workers: { label: "عامل", href: (id) => `/workers/${id}` },
  worker_wages: { label: "أجر عامل", href: (id) => `/workers/${id}` },
  worker_payments: { label: "دفعة عامل" },
  machines: { label: "ماكنة", href: (id) => `/machines/${id}` },
  maintenance: { label: "صيانة", href: (id) => `/maintenance/${id}` },
  documents: { label: "مستند", href: (id) => `/documents/${id}` },
  profiles: { label: "مستخدم" },
};

const ACTION: Record<string, string> = { insert: "إضافة", update: "تعديل", delete: "حذف" };

const FIELD: Record<string, string> = {
  price: "السعر", paid: "المستلم", cost_labor: "الأجور", cost_machine: "التشغيل", cost_other: "كلف أخرى",
  qty: "الكمية", unit_price: "سعر الوحدة", min_qty: "حد الطلب", status: "الحالة", client: "الزبون",
  product: "المنتج", due_date: "موعد التسليم", daily_wage: "الأجر اليومي", amount: "المبلغ", kind: "النوع",
  name: "الاسم", full_name: "الاسم", role: "الدور", active: "مفعّل", subject: "الموضوع", priority: "الأولوية",
  notes: "ملاحظات", cost: "الكلفة", state: "الحالة", day: "التاريخ", note: "ملاحظة", currency: "العملة",
};

const show = (v: unknown) => (v === null || v === undefined || v === "" ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v));

function summary(action: string, changes: Record<string, unknown>) {
  if (action === "update") {
    return Object.entries(changes as Record<string, [unknown, unknown]>)
      .map(([k, [a, b]]) => `${FIELD[k] ?? k}: ${show(a)} ← ${show(b)}`)
      .join("، ");
  }
  const c = changes as Record<string, unknown>;
  const title = c.subject ?? c.product ?? c.name ?? c.full_name ?? c.description;
  const extra = ["qty", "price", "amount", "daily_wage"].filter((k) => c[k] != null).map((k) => `${FIELD[k]}: ${show(c[k])}`);
  return [title && show(title), ...extra].filter(Boolean).join("، ");
}

export default async function AuditPage({ searchParams }: PageProps) {
  await requireRole(can.users);
  const __sp = await searchParams;
  const { table, error } = __sp;
  const pg = paging(__sp);
  const db = await supabase();
  let q = db.from("audit_log").select("*").order("at", { ascending: false }).range(pg.from, pg.to);
  if (table) q = q.eq("table_name", table);
  const [{ data: rowsAll }, { data: people }] = await Promise.all([q, db.from("profiles").select("id, full_name")]);
  const { rows: rows, more } = cut(rowsAll);
  const who = new Map((people ?? []).map((p) => [p.id, p.full_name]));

  return (
    <>
      <Alert error={error} />
      <form className="bar" method="get">
        <h2>سجل التعديلات</h2>
        <select name="table" defaultValue={table ?? ""} aria-label="القسم">
          <option value="">كل الأقسام</option>
          {Object.entries(TABLES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <button className="btn ghost" type="submit">عرض</button>
      </form>
      <p className="meta">آخر 300 تعديل: منو غيّر شنو وشوكت. القيمة القديمة ← الجديدة.</p>
      {!rows?.length ? (
        <div className="empty">ما بيه تعديلات مسجلة بعد.</div>
      ) : (
        <div className="tbl">
          <table>
            <thead><tr><th>الوقت</th><th>المستخدم</th><th>العملية</th><th>القسم</th><th>التفاصيل</th></tr></thead>
            <tbody>
              {rows.map((r) => {
                const t = TABLES[r.table_name];
                const link = t?.href && r.row_id && r.action !== "delete" ? t.href(r.row_id) : null;
                return (
                  <tr key={r.id}>
                    <td className="num">{new Date(r.at).toLocaleString("en-GB", { timeZone: "Asia/Baghdad", dateStyle: "short", timeStyle: "short" })}</td>
                    <td>{(r.user_id && who.get(r.user_id)) ?? "النظام"}</td>
                    <td className={r.action === "delete" ? "tone-bad" : r.action === "insert" ? "tone-ok" : ""}>{ACTION[r.action]}</td>
                    <td>{link ? <Link href={link}>{t!.label}</Link> : t?.label ?? r.table_name}</td>
                    <td style={{ whiteSpace: "normal", minWidth: 260, fontSize: 13 }}>{summary(r.action, r.changes)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <Pager page={pg.page} more={more} sp={__sp} path="/audit" />
    </>
  );
}
