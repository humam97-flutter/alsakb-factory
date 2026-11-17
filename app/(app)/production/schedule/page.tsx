import Link from "next/link";
import { Pill } from "@/components/ui";
import { MACHINE_STATUS, PRIORITY, STAGE_STATUS, today } from "@/lib/labels";
import { supabase } from "@/lib/supabase/server";

type Stage = {
  id: string;
  name: string;
  status: string;
  position: number;
  machine_id: string | null;
  order: { id: string; no: number; product: string; client: string | null; due_date: string | null; priority: string; status: string };
};

const RANK: Record<string, number> = { urgent: 0, high: 1, normal: 2 };

// شنو ينتظر كل ماكنة: المراحل غير المنجزة بالأوامر المفتوحة، الأعجل أولاً
export default async function SchedulePage() {
  const db = await supabase();
  const [{ data: machines }, { data: stages }] = await Promise.all([
    db.from("machines").select("id, code, name, status").order("code"),
    db
      .from("work_order_stages")
      .select("id, name, status, position, machine_id, order:work_orders!inner(id, no, product, client, due_date, priority, status)")
      .neq("status", "done")
      .in("order.status", ["new", "in_progress", "on_hold"]),
  ]);
  const t = today();
  const list = (stages ?? []) as unknown as Stage[];
  const sortKey = (s: Stage) => [s.status === "working" ? 0 : 1, RANK[s.order.priority] ?? 2, s.order.due_date ?? "9999", s.order.no, s.position] as const;
  const cmp = (a: Stage, b: Stage) => {
    const x = sortKey(a), y = sortKey(b);
    for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] < y[i] ? -1 : 1;
    return 0;
  };
  const byMachine = new Map<string, Stage[]>();
  for (const s of list) {
    const k = s.machine_id ?? "none";
    byMachine.set(k, [...(byMachine.get(k) ?? []), s]);
  }
  const ms = [...(machines ?? [])].sort((a, b) => Number(a.code) - Number(b.code));
  const cols = [...ms.map((m) => ({ id: m.id, title: `${m.code}. ${m.name}`, status: m.status })), { id: "none", title: "بدون ماكنة محددة", status: null }];

  return (
    <>
      <div className="bar"><h2>جدول المكائن</h2></div>
      <p className="meta">كل ماكنة وشنو ينتظرها من مراحل. اللي «قيد العمل» فوق، بعدها العاجل، بعدها الأقرب تسليماً. حدد الماكنة لكل مرحلة من صفحة الأمر.</p>
      <div className="grid">
        {cols.map((c) => {
          const items = (byMachine.get(c.id) ?? []).sort(cmp);
          if (c.id === "none" && !items.length) return null;
          return (
            <div key={c.id} className="panel" style={{ padding: 10 }}>
              <div className="row between">
                <b>{c.title}</b>
                {c.status && <Pill map={MACHINE_STATUS} value={c.status} />}
              </div>
              <div className="meta" style={{ marginBottom: 6 }}>{items.length ? `${items.length} مرحلة تنتظر` : "فاضية"}</div>
              {items.slice(0, 8).map((s) => {
                const late = s.order.due_date && s.order.due_date < t;
                return (
                  <Link key={s.id} href={`/orders/${s.order.id}`} className="row between" style={{ textDecoration: "none", color: "inherit", padding: "5px 0", borderTop: "1px solid var(--line)", fontSize: 13 }}>
                    <span>
                      #{s.order.no} · {s.name}
                      <span className="meta" style={{ display: "block" }}>
                        {s.order.product}
                        {s.order.due_date && <span className={late ? "tone-bad" : ""}> · {s.order.due_date}</span>}
                      </span>
                    </span>
                    <span className="row" style={{ gap: 4 }}>
                      {s.order.priority !== "normal" && <Pill map={PRIORITY} value={s.order.priority} />}
                      <Pill map={STAGE_STATUS} value={s.status} />
                    </span>
                  </Link>
                );
              })}
              {items.length > 8 && <div className="meta">و{items.length - 8} غيرها</div>}
            </div>
          );
        })}
      </div>
    </>
  );
}
