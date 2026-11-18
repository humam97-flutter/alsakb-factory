import { weightProgress } from "@/lib/planning";
import { advanceOutstanding, retentionHeld } from "@/lib/projects";
import type { supabase } from "@/lib/supabase/server";

type Db = Awaited<ReturnType<typeof supabase>>;

export type ProjectSummary = {
  progress: number;      // الإنجاز الفعلي بالوزن
  invoiced: number;      // صافي المفوتر
  invoicedGross: number; // دفعات الإنجاز المفوترة قبل الطرح (بدون السلفة)
  paid: number;
  receivable: number;
  retention: number;
  advance: number;
  cost: number;          // كلفة الأوامر لحد الآن
  fees: number;          // عمولات الضمانات
  orderProgress: Map<string, number>;
};

// ملخص مالي وإنجاز لكل مشروع
export async function summarize(db: Db, projects: { id: string; contract_value: number; retention_pct: number; advance_pct: number }[]) {
  const ids = projects.map((p) => p.id);
  const out = new Map<string, ProjectSummary>();
  if (!ids.length) return out;
  const [{ data: orders }, { data: ms }, { data: invs }, { data: gs }] = await Promise.all([
    db.from("work_orders").select("id, project_id, weight_kg, stages:work_order_stages(status, progress, weight_pct)").in("project_id", ids),
    db.from("project_milestones").select("project_id, kind, pct, status, invoice_id").in("project_id", ids),
    db.from("invoices").select("id, project_id, cancelled").in("project_id", ids),
    db.from("guarantees").select("project_id, fee").in("project_id", ids),
  ]);
  const orderIds = (orders ?? []).map((o) => o.id);
  const invIds = (invs ?? []).filter((i) => !i.cancelled).map((i) => i.id);
  const [{ data: costs }, { data: tots }] = await Promise.all([
    orderIds.length ? db.from("work_order_costs").select("order_id, cost_total").in("order_id", orderIds) : Promise.resolve({ data: [] as { order_id: string; cost_total: number }[] }),
    invIds.length ? db.from("invoice_totals").select("invoice_id, total, paid, balance").in("invoice_id", invIds) : Promise.resolve({ data: [] as { invoice_id: string; total: number; paid: number; balance: number }[] }),
  ]);
  const costOf = new Map((costs ?? []).map((c) => [c.order_id, Number(c.cost_total)]));
  const totOf = new Map((tots ?? []).map((t) => [t.invoice_id, t]));
  for (const p of projects) {
    const os = (orders ?? []).filter((o) => o.project_id === p.id);
    const orderProgress = new Map(os.map((o) => [o.id, weightProgress((o.stages as never[]) ?? [])]));
    const wsum = os.reduce((a, o) => a + Number(o.weight_kg ?? 0), 0);
    const progress = os.length
      ? Math.round(wsum > 0 ? os.reduce((a, o) => a + Number(o.weight_kg ?? 0) * orderProgress.get(o.id)!, 0) / wsum : os.reduce((a, o) => a + orderProgress.get(o.id)!, 0) / os.length)
      : 0;
    const pms = (ms ?? []).filter((m) => m.project_id === p.id);
    const pinv = (invs ?? []).filter((i) => i.project_id === p.id && !i.cancelled).map((i) => totOf.get(i.id)).filter(Boolean) as { total: number; paid: number; balance: number }[];
    const invoiced = pinv.reduce((a, t) => a + Number(t.total), 0);
    const paid = pinv.reduce((a, t) => a + Number(t.paid), 0);
    const invoicedGross = pms.filter((m) => m.status !== "pending" && (m.kind === "progress" || m.kind === "delivery")).reduce((a, m) => a + (Number(p.contract_value) * Number(m.pct)) / 100, 0);
    out.set(p.id, {
      progress,
      invoiced,
      invoicedGross,
      paid,
      receivable: invoiced - paid,
      retention: retentionHeld(p, pms),
      advance: advanceOutstanding(p, pms),
      cost: os.reduce((a, o) => a + (costOf.get(o.id) ?? 0), 0),
      fees: (gs ?? []).filter((g) => g.project_id === p.id).reduce((a, g) => a + Number(g.fee ?? 0), 0),
      orderProgress,
    });
  }
  return out;
}
