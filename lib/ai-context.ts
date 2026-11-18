import { collectAlerts } from "@/lib/alerts";
import { can, type Me } from "@/lib/auth";
import { MACHINE_STATUS, ORDER_STATUS, PRIORITY, today } from "@/lib/labels";
import { weightProgress } from "@/lib/planning";
import { summarize } from "@/lib/project-summary";
import type { supabase } from "@/lib/supabase/server";

type Db = Awaited<ReturnType<typeof supabase>>;
const n = (v: unknown) => Math.round(Number(v ?? 0) * 100) / 100;

// لقطة مختصرة من بيانات المعمل يقرأها المساعد. تُقرأ بصلاحيات المستخدم نفسه، فالمحاسب يشوف المالية والمشغل ما يشوفها
export async function factorySnapshot(db: Db, me: Pick<Me, "role">) {
  const t = today();
  const fin = can.finance(me.role);
  const none = Promise.resolve({ data: null });
  const [orders, materials, plates, machines, att, prices, alerts, bal, pnl, projects, tenders, guarantees] = await Promise.all([
    db
      .from("work_orders")
      .select("id, no, product, client, qty, unit, status, priority, start_date, due_date, weight_kg, stages:work_order_stages(name, status, progress, weight_pct, position, plan_end)")
      .in("status", ["new", "in_progress", "on_hold", "done"])
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(80),
    db.from("materials").select("name, spec, grade, qty, min_qty, unit, unit_price, currency").order("name").limit(150),
    db.from("plates").select("grade, thickness, length_mm, width_mm, parent_id").eq("status", "available").limit(1000),
    db.from("machines").select("code, name, status, next_service"),
    db.from("attendance").select("status").eq("day", t),
    db.from("steel_prices").select("day, item, grade, thickness, price_ton, currency, source").order("day", { ascending: false }).limit(20),
    collectAlerts(db, me),
    fin ? db.from("customer_balances").select("balance, currency, customer:customers(name)").gt("balance", 0).order("balance", { ascending: false }).limit(25) : none,
    fin ? db.from("monthly_pnl").select("*").order("month", { ascending: false }).limit(6) : none,
    fin ? db.from("projects").select("id, no, name, contract_value, currency, status, end_date, retention_pct, advance_pct").in("status", ["active", "hold"]) : none,
    fin ? db.from("tenders").select("no, title, issuer, submit_due, status, our_price, currency").in("status", ["preparing", "submitted"]) : none,
    fin ? db.from("guarantees").select("kind, bank, amount, currency, expires_on").eq("status", "active").order("expires_on") : none,
  ]);

  const out: Record<string, unknown> = { "تاريخ اليوم": t, "دور المستخدم": me.role };

  out["أوامر العمل المفتوحة"] = (orders.data ?? []).map((o) => {
    const st = ((o.stages ?? []) as { name: string; status: string; progress: number; weight_pct: number; position: number; plan_end: string | null }[]).sort((a, b) => a.position - b.position);
    const cur = st.find((s) => s.status !== "done");
    return {
      رقم: o.no,
      المنتج: o.product,
      الزبون: o.client,
      الكمية: `${n(o.qty)} ${o.unit ?? ""}`.trim(),
      الحالة: ORDER_STATUS[o.status]?.label ?? o.status,
      الأولوية: PRIORITY[o.priority]?.label ?? o.priority,
      التسليم: o.due_date,
      "الوزن كغم": o.weight_kg ? n(o.weight_kg) : undefined,
      "الإنجاز %": weightProgress(st as never),
      "المرحلة الحالية": cur ? `${cur.name}${cur.plan_end ? ` (مخطط تخلص ${cur.plan_end})` : ""}` : st.length ? "كل المراحل خلصت" : "بدون مراحل",
    };
  });

  out["المواد بالمخزن"] = (materials.data ?? []).map((m) => ({
    المادة: [m.name, m.spec, m.grade].filter(Boolean).join(" "),
    الموجود: `${n(m.qty)} ${m.unit}`,
    "الحد الأدنى": m.min_qty != null ? n(m.min_qty) : undefined,
    ...(fin ? { السعر: `${n(m.unit_price)} ${m.currency}` } : {}),
  }));

  // الألواح المتوفرة مجمّعة بالنوع والسمك
  const pg = new Map<string, { عدد: number; بقايا: number }>();
  for (const p of plates.data ?? []) {
    const k = `${p.grade} سمك ${n(p.thickness)} ملم`;
    const e = pg.get(k) ?? { عدد: 0, بقايا: 0 };
    e.عدد++;
    if (p.parent_id) e.بقايا++;
    pg.set(k, e);
  }
  out["الألواح المتوفرة"] = Object.fromEntries(pg);

  out["المكائن"] = (machines.data ?? []).map((m) => ({ الماكنة: `${m.code} ${m.name}`, الحالة: MACHINE_STATUS[m.status]?.label ?? m.status, "الصيانة القادمة": m.next_service }));
  const a = att.data ?? [];
  out["حضور اليوم"] = { حاضر: a.filter((x) => x.status === "present").length, "نص يوم": a.filter((x) => x.status === "half").length, غائب: a.filter((x) => x.status === "absent").length, إجازة: a.filter((x) => x.status === "leave").length };
  out["أسعار الحديد المسجلة"] = prices.data ?? [];
  out["التنبيهات الحالية"] = alerts.map((x) => `${x.level === "bad" ? "عاجل" : "تنبيه"} · ${x.group}: ${x.text}`);

  if (fin) {
    out["ديون الزبائن"] = (bal.data ?? []).map((b) => ({ الزبون: (b.customer as unknown as { name: string } | null)?.name, الباقي: `${n(b.balance)} ${b.currency}` }));
    out["الأرباح والخسائر الشهرية"] = pnl.data ?? [];
    const ps = (projects.data ?? []) as { id: string; no: number; name: string; contract_value: number; currency: string; status: string; end_date: string | null; retention_pct: number; advance_pct: number }[];
    const sum = await summarize(db, ps);
    out["المشاريع"] = ps.map((p) => {
      const s = sum.get(p.id);
      return { رقم: p.no, المشروع: p.name, "قيمة العقد": `${n(p.contract_value)} ${p.currency}`, "الإنجاز %": s?.progress, المفوتر: n(s?.invoiced), المستلم: n(s?.paid), المحتجز: n(s?.retention), "الكلفة لحد الآن": n(s?.cost), "نهاية العقد": p.end_date };
    });
    out["المناقصات المفتوحة"] = tenders.data ?? [];
    out["خطابات الضمان السارية"] = guarantees.data ?? [];
  }
  return out;
}
