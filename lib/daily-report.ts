import { collectAlerts } from "@/lib/alerts";
import { addDays, money, num, today } from "@/lib/labels";
import type { supabase } from "@/lib/supabase/server";

type Db = Awaited<ReturnType<typeof supabase>>;

// التقرير اليومي: نص قصير يوصل لتيليكرام كل صباح (أو ينرسل واتساب يدوياً)
export async function dailyReport(db: Db, site?: string) {
  const t = today();
  const y = addDays(t, -1);
  const [{ data: st }, { data: orders }, { data: stages }, { data: pays }, alerts] = await Promise.all([
    db.from("settings").select("factory_name").eq("id", 1).maybeSingle(),
    db.from("work_orders").select("no, product, due_date, status").in("status", ["new", "in_progress", "on_hold"]),
    db.from("work_order_stages").select("name, weight_pct, order:work_orders!inner(no, weight_kg)").eq("status", "done").gte("done_at", y).lt("done_at", t),
    db.from("customer_payments").select("amount, currency").eq("day", y),
    collectAlerts(db, { role: "manager" }),
  ]);
  const os = orders ?? [];
  const late = os.filter((o) => o.due_date && o.due_date < t);
  const soon = os.filter((o) => o.due_date && o.due_date >= t && o.due_date <= addDays(t, 3));
  const kg = (stages ?? []).reduce((a, s) => a + (Number((s.order as unknown as { weight_kg: number | null }).weight_kg ?? 0) * Number(s.weight_pct ?? 0)) / 100, 0);
  const paid = new Map<string, number>();
  for (const p of pays ?? []) paid.set(p.currency, (paid.get(p.currency) ?? 0) + Number(p.amount));

  const L: string[] = [];
  L.push(`📋 تقرير ${st?.factory_name ?? "المعمل"} · ${t}`);
  L.push("");
  L.push(`🏭 أوامر مفتوحة: ${os.length}` + (late.length ? ` · متأخرة: ${late.length}` : "") + (soon.length ? ` · تسليمها خلال 3 أيام: ${soon.length}` : ""));
  for (const o of late.slice(0, 5)) L.push(`  🔴 #${o.no} ${o.product} (التسليم ${o.due_date})`);
  for (const o of soon.slice(0, 5)) L.push(`  🟡 #${o.no} ${o.product} (التسليم ${o.due_date})`);
  L.push(`✅ مراحل خلصت أمس: ${stages?.length ?? 0}` + (kg > 0 ? ` (≈ ${num(Math.round(kg / 100) / 10)} طن)` : ""));
  if (paid.size) L.push(`💰 قبض أمس: ${[...paid].map(([c, v]) => money(v, c)).join(" + ")}`);
  const bad = alerts.filter((a) => a.level === "bad");
  const warn = alerts.filter((a) => a.level === "warn");
  if (alerts.length) {
    L.push("");
    L.push(`⚠️ تنبيهات: ${bad.length} عاجلة، ${warn.length} للمتابعة`);
    for (const a of [...bad, ...warn].slice(0, 12)) L.push(`  ${a.level === "bad" ? "🔴" : "🟡"} ${a.group}: ${a.text}`);
    if (alerts.length > 12) L.push(`  ... و${alerts.length - 12} غيرها`);
  } else {
    L.push("", "👌 ماكو تنبيهات اليوم.");
  }
  if (site) L.push("", `🔗 ${site}/alerts`);
  return L.join("\n");
}
