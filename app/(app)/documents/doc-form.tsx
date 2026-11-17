import Link from "next/link";
import { Input, Select, TextArea } from "@/components/ui";
import { CURRENCIES, DOC_KIND, DOC_STATUS, labelsOf, today } from "@/lib/labels";
import { saveDocument } from "./actions";

export function DocForm({
  d,
  orders,
  defaults = {},
  replyTo,
}: {
  d: Record<string, any> | null;
  orders: { id: string; no: number; product: string }[];
  defaults?: Record<string, string | undefined>;
  replyTo?: { id: string; ref_no: string; subject: string } | null;
}) {
  const v = (k: string) => d?.[k] ?? defaults[k] ?? null;
  return (
    <form action={saveDocument} className="panel">
      {d && <input type="hidden" name="id" value={d.id} />}
      {replyTo && <input type="hidden" name="reply_to" value={replyTo.id} />}
      {d?.reply_to && <input type="hidden" name="reply_to" value={d.reply_to} />}
      {replyTo && (
        <p className="meta" style={{ marginTop: 0 }}>
          ردّاً على: <b>{replyTo.ref_no}</b> · {replyTo.subject}
        </p>
      )}
      <div className="fields">
        <Select name="kind" label="النوع" options={labelsOf(DOC_KIND)} value={v("kind") ?? "incoming"} blank={false} />
        <Input name="ref_no" label="رقم الكتاب أو العقد (فارغ = رقم تلقائي)" value={v("ref_no")} />
        <Input name="doc_date" label="التاريخ" value={v("doc_date") ?? today()} type="date" />
        <Select name="status" label="الحالة" options={labelsOf(DOC_STATUS)} value={v("status") ?? "pending"} blank={false} />
        <Input name="subject" label="الموضوع" value={v("subject")} full required />
        <Input name="party" label="الجهة (المرسِل، المرسَل إليه، أو الطرف الثاني)" value={v("party")} full />
        <Input name="due_date" label="موعد الرد أو الإجراء" value={v("due_date")} type="date" />
        <Select
          name="order_id"
          label="مرتبط بأمر عمل"
          options={Object.fromEntries(orders.map((o) => [o.id, `#${o.no} · ${o.product}`]))}
          value={v("order_id")}
        />
        <Input name="starts_on" label="يبدأ من (للعقود والإجازات)" value={v("starts_on")} type="date" />
        <Input name="expires_on" label="ينتهي في" value={v("expires_on")} type="date" />
        <Input name="amount" label="المبلغ" value={v("amount")} type="number" />
        <Select name="currency" label="العملة" options={CURRENCIES} value={v("currency") ?? "IQD"} blank={false} />
        <TextArea name="summary" label="الخلاصة أو الملاحظات" value={v("summary")} />
      </div>
      <div className="actions">
        <button className="btn" type="submit">حفظ</button>
        <Link className="btn ghost" href={d ? `/documents/${d.id}` : "/documents"}>إلغاء</Link>
      </div>
    </form>
  );
}
