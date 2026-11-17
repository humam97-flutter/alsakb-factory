import Link from "next/link";
import { Alert, Input, type PageProps } from "@/components/ui";
import { can, requireRole } from "@/lib/auth";
import { MOVE, num, today } from "@/lib/labels";
import { supabase } from "@/lib/supabase/server";
import { saveMove } from "../actions";

const HELP: Record<string, string> = {
  issue: "سحب مواد من المخزن. إذا اخترت أمر عمل، تنضاف قيمتها لكلفته.",
  receive: "مواد وصلت من المورد. اكتب سعر الوحدة إذا تغيّر، أو اتركه فارغاً لاستخدام السعر المسجل.",
  adjust: "بعد العد الفعلي: اكتب الرصيد الموجود فعلاً، والنظام يسجل الفرق.",
};

export default async function MovePage({ searchParams }: PageProps) {
  await requireRole(can.stock);
  const sp = await searchParams;
  const kind = sp.kind && MOVE[sp.kind] ? sp.kind : "issue";
  const db = await supabase();
  const [{ data: materials }, { data: orders }] = await Promise.all([
    db.from("materials").select("id, name, spec, qty, unit").order("name"),
    db.from("work_orders").select("id, no, product").not("status", "in", "(delivered,cancelled)").order("no", { ascending: false }),
  ]);
  return (
    <>
      <div className="bar">
        <h2>{MOVE[kind].label}</h2>
        {Object.entries(MOVE).map(([k, v]) => (
          <Link key={k} className={`btn sm ${k === kind ? "" : "ghost"}`} href={`/stock/move?kind=${k}${sp.order ? `&order=${sp.order}` : ""}`}>
            {v.label}
          </Link>
        ))}
      </div>
      <Alert error={sp.error} />
      <p className="meta">{HELP[kind]}</p>
      <form action={saveMove} className="panel">
        <input type="hidden" name="kind" value={kind} />
        <div className="fields">
          <label className="full">
            المادة
            <select id="f_material_id" name="material_id" defaultValue={sp.material ?? ""} required>
              <option value=""></option>
              {(materials ?? []).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} {m.spec ? `· ${m.spec}` : ""} (الرصيد {num(m.qty)} {m.unit})
                </option>
              ))}
            </select>
          </label>
          <Input name="qty" label={kind === "adjust" ? "الرصيد الفعلي بعد العد" : "الكمية"} type="number" required />
          <Input name="day" label="التاريخ" type="date" value={today()} />
          {kind === "issue" && (
            <label className="full">
              لأمر العمل
              <select id="f_order_id" name="order_id" defaultValue={sp.order ?? ""}>
                <option value="">بدون أمر (استهلاك عام)</option>
                {(orders ?? []).map((o) => (
                  <option key={o.id} value={o.id}>
                    #{o.no} · {o.product}
                  </option>
                ))}
              </select>
            </label>
          )}
          {kind === "receive" && <Input name="unit_price" label="سعر الوحدة (اختياري)" type="number" />}
          <Input name="note" label={kind === "receive" ? "المورد / رقم الوصل" : "ملاحظة"} full />
        </div>
        <div className="actions">
          <button className="btn" type="submit">تسجيل</button>
          <Link className="btn ghost" href="/stock">إلغاء</Link>
        </div>
      </form>
    </>
  );
}
