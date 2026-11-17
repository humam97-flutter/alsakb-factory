import { cache } from "react";
import { can, type Me } from "./auth";
import { addDays, money, num, today } from "./labels";
import { supabase } from "./supabase/server";

export type AlertItem = { level: "bad" | "warn"; group: string; text: string; href: string };

// كل التنبيهات اللي تخص المستخدم حسب دوره، بمكان واحد
export const getAlerts = cache(async (me: Me): Promise<AlertItem[]> => {
  const db = await supabase();
  const t = today();
  const r = me.role;
  const out: AlertItem[] = [];
  const none = Promise.resolve({ data: null });

  const [orders, materials, machines, plans, maint, reqs, docs, invoices, purchases] = await Promise.all([
    db.from("work_orders").select("id, no, product, due_date, status").in("status", ["new", "in_progress", "on_hold", "done"]).lte("due_date", addDays(t, 2)),
    db.from("materials").select("id, name, spec, qty, min_qty, unit").not("min_qty", "is", null),
    db.from("machines").select("id, code, name, status").in("status", ["broken"]),
    db.from("maintenance_plans").select("id, task, next_due, machine:machines(code, name)").eq("active", true).lte("next_due", t),
    db.from("maintenance").select("id").neq("state", "done"),
    can.finance(r) ? db.from("purchase_requests").select("id, description").eq("status", "pending") : none,
    can.docs(r)
      ? db.from("documents").select("id, ref_no, subject, status, due_date, expires_on").neq("status", "archived").or(`and(status.eq.pending,due_date.lte.${t}),expires_on.lte.${addDays(t, 30)}`)
      : none,
    can.finance(r) ? db.from("invoices").select("id, no, due_date, currency, customer:customers(name)").eq("cancelled", false).lt("due_date", t) : none,
    can.finance(r) ? db.from("purchase_invoices").select("id, no, due_date, currency, supplier:suppliers(name)").lte("due_date", addDays(t, 3)) : none,
  ]);

  for (const o of orders.data ?? []) {
    if (o.status === "done") continue;
    const late = o.due_date! < t;
    out.push({ level: late ? "bad" : "warn", group: "أوامر العمل", text: `#${o.no} ${o.product}: ${late ? "متأخر من" : "التسليم"} ${o.due_date}`, href: `/orders/${o.id}` });
  }
  for (const m of machines.data ?? []) out.push({ level: "bad", group: "المكائن", text: `${m.code}. ${m.name} عاطلة`, href: `/machines/${m.id}` });
  for (const p of plans.data ?? []) {
    const m = p.machine as unknown as { code: string; name: string };
    out.push({ level: "warn", group: "الصيانة", text: `${m.code}. ${m.name}: ${p.task} (من ${p.next_due})`, href: "/maintenance" });
  }
  if ((maint.data?.length ?? 0) > 0) out.push({ level: "warn", group: "الصيانة", text: `${maint.data!.length} عطل مفتوح`, href: "/maintenance" });
  if (can.stock(r) || can.finance(r) || can.production(r)) {
    for (const m of (materials.data ?? []).filter((m) => Number(m.qty) <= Number(m.min_qty))) {
      out.push({ level: Number(m.qty) <= 0 ? "bad" : "warn", group: "المخزن", text: `${m.name}${m.spec ? " " + m.spec : ""}: باقي ${num(m.qty)} ${m.unit}`, href: "/purchases/requests" });
    }
  }
  if ((reqs.data?.length ?? 0) > 0) out.push({ level: "warn", group: "المشتريات", text: `${reqs.data!.length} طلب شراء ينتظر موافقتك`, href: "/purchases/requests" });
  for (const d of docs.data ?? []) {
    const exp = d.expires_on && d.expires_on <= addDays(t, 30);
    out.push({
      level: (exp && d.expires_on! < t) || (!exp && d.due_date && d.due_date < t) ? "bad" : "warn",
      group: "المستندات",
      text: `${d.ref_no} ${d.subject}: ${exp ? (d.expires_on! < t ? "انتهى " : "ينتهي ") + d.expires_on : "الرد مطلوب من " + d.due_date}`,
      href: `/documents/${d.id}`,
    });
  }
  if (invoices.data?.length) {
    const ids = invoices.data.map((i) => i.id);
    const { data: tot } = await db.from("invoice_totals").select("invoice_id, balance").in("invoice_id", ids).gt("balance", 0);
    const bal = new Map((tot ?? []).map((x) => [x.invoice_id, Number(x.balance)]));
    for (const i of invoices.data.filter((i) => bal.has(i.id))) {
      const c = i.customer as unknown as { name: string };
      out.push({ level: "bad", group: "ديون الزبائن", text: `فاتورة #${i.no} ${c.name}: باقي ${money(bal.get(i.id), i.currency)} من ${i.due_date}`, href: `/sales/invoices/${i.id}` });
    }
  }
  if (purchases.data?.length) {
    const ids = purchases.data.map((i) => i.id);
    const { data: tot } = await db.from("purchase_totals").select("invoice_id, balance").in("invoice_id", ids).gt("balance", 0);
    const bal = new Map((tot ?? []).map((x) => [x.invoice_id, Number(x.balance)]));
    for (const i of purchases.data.filter((i) => bal.has(i.id))) {
      const s = i.supplier as unknown as { name: string };
      out.push({ level: i.due_date! < t ? "bad" : "warn", group: "تسديد الموردين", text: `${s.name} #${i.no}: ${money(bal.get(i.id), i.currency)} موعده ${i.due_date}`, href: `/purchases/invoices/${i.id}` });
    }
  }
  // قص هدره عالي خلال آخر 7 أيام
  if (can.production(r)) {
    const [{ data: cs }, { data: st }] = await Promise.all([
      db.from("cut_plans").select("id, plate_kg, scrap_kg, loss_value, order:work_orders(no)").eq("status", "done").gte("done_at", addDays(t, -7)),
      db.from("settings").select("loss_alert_pct").eq("id", 1).maybeSingle(),
    ]);
    const lim = Number(st?.loss_alert_pct ?? 20);
    for (const c of cs ?? []) {
      const waste = Number(c.plate_kg) ? (Number(c.scrap_kg) / Number(c.plate_kg)) * 100 : 0;
      if (waste > lim) {
        const o = c.order as unknown as { no: number };
        out.push({ level: "warn", group: "القص", text: `أمر #${o?.no}: هدر ${waste.toFixed(0)}% بلوح واحد (${money(c.loss_value)})`, href: `/cutting/plans/${c.id}` });
      }
    }
  }
  // الجودة: مؤهلات لحام تنتهي، حالات عدم مطابقة مفتوحة، لحامات تحتاج تصليح
  if (can.production(r)) {
    const [{ data: qs }, { data: nc }, { data: rep }] = await Promise.all([
      db.from("welder_quals").select("id, process, expires_on, worker:workers(full_name)").lte("expires_on", addDays(t, 30)).gte("expires_on", addDays(t, -60)),
      db.from("ncrs").select("id").eq("status", "open"),
      db.from("welds").select("order_id, code, order:work_orders(no)").eq("status", "repair"),
    ]);
    for (const q of qs ?? []) {
      const w = q.worker as unknown as { full_name: string };
      out.push({ level: q.expires_on! < t ? "bad" : "warn", group: "الجودة", text: `مؤهل ${w?.full_name} (${q.process}) ${q.expires_on! < t ? "انتهى" : "ينتهي"} ${q.expires_on}`, href: "/quality" });
    }
    if (nc?.length) out.push({ level: "warn", group: "الجودة", text: `${nc.length} حالة عدم مطابقة مفتوحة`, href: "/quality/ncr" });
    const byOrder = new Map<string, { no: number; codes: string[] }>();
    for (const w of rep ?? []) {
      const e = byOrder.get(w.order_id) ?? { no: (w.order as unknown as { no: number })?.no, codes: [] };
      e.codes.push(w.code);
      byOrder.set(w.order_id, e);
    }
    for (const [oid, e] of byOrder) out.push({ level: "bad", group: "الجودة", text: `أمر #${e.no}: لحامات تحتاج تصليح ${e.codes.join("، ")}`, href: `/orders/${oid}/qa` });
  }
  return out.sort((a, b) => (a.level === b.level ? 0 : a.level === "bad" ? -1 : 1));
});
