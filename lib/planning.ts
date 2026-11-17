// تخطيط الإنتاج: توزيع ساعات الأمر على مراكز العمل وجدولتها بالأيام
// القيم الافتراضية (الساعات لكل طن، نسب المراحل) من lib/estimate، والمهندس يراجعها

import { DEFAULT_RATES, STAGE_SPLIT, type Rates } from "@/lib/estimate";

export const CENTER_KIND: Record<string, string> = {
  cut: "قص", roll: "درفلة", fit: "تجميع", weld: "لحام", grind: "جلخ", test: "فحص", paint: "صبغ", other: "أخرى",
};

export const PRODUCT_TYPE: Record<string, string> = { vessel: "وعاء ضغط", tank: "خزان", structure: "هياكل", other: "أخرى" };

// اسم المرحلة ← نوع مركز العمل
export function kindOf(name: string): string | null {
  if (/قص|تثقيب|تحضير/.test(name)) return "cut";
  if (/درفل|ثني|كبس/.test(name)) return "roll";
  if (/تجميع|تركيب|فيت/.test(name)) return "fit";
  if (/لحام/.test(name)) return "weld";
  if (/جلخ|تشطيب/.test(name)) return "grind";
  if (/فحص|اختبار/.test(name)) return "test";
  if (/صبغ|سفع/.test(name)) return "paint";
  return null;
}

export type Center = { id: string; code: string; name: string; kind: string; hours_day: number; people: number; efficiency: number; color: number };

// الساعات الفعلية المتاحة باليوم بمركز العمل
export const dayCapacity = (c: Pick<Center, "hours_day" | "people" | "efficiency">) => Number(c.hours_day) * Number(c.people) * (Number(c.efficiency) / 100);

// ---------- التواريخ ----------
const D = (s: string) => new Date(s + "T00:00:00Z");
export const iso = (d: Date) => d.toISOString().slice(0, 10);
export const addDays = (s: string, n: number) => {
  const d = D(s);
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
};
export const diffDays = (a: string, b: string) => Math.round((D(b).getTime() - D(a).getTime()) / 86400000);
export const isOff = (s: string, off: number[]) => off.includes(D(s).getUTCDay());
export const nextWorkDay = (s: string, off: number[]) => {
  let d = s;
  for (let i = 0; i < 7 && isOff(d, off); i++) d = addDays(d, 1);
  return d;
};
// آخر يوم بعد n يوم شغل (يبدأ من start ويحسبه)
export function addWorkDays(start: string, n: number, off: number[]) {
  let d = nextWorkDay(start, off);
  for (let left = Math.max(1, n) - 1; left > 0; ) {
    d = addDays(d, 1);
    if (!isOff(d, off)) left--;
  }
  return d;
}
export function workDaysBetween(a: string, b: string, off: number[]) {
  let n = 0;
  for (let d = a; d <= b; d = addDays(d, 1)) if (!isOff(d, off)) n++;
  return n;
}

// ---------- الخطة ----------
export type StageIn = { id: string; name: string; status: string; work_center_id: string | null; plan_hours: number | null; plan_start?: string | null; plan_end?: string | null };
export type StagePlan = { id: string; work_center_id: string | null; plan_hours: number; weight_pct: number; plan_start: string | null; plan_end: string | null };

// مجموع ساعات الأمر: ساعات التسعير إذا موجودة، وإلا الوزن × ساعات الطن
export function orderHours(weightKg: number | null, type: string | null, rates: Rates = DEFAULT_RATES, estHours?: number | null) {
  if (estHours && estHours > 0) return estHours;
  const key = `hours_${type ?? "other"}` as keyof Rates;
  const perTon = Number(rates[key] ?? rates.hours_other);
  return Math.max(4, ((weightKg ?? 1000) / 1000) * perTon);
}

// نسبة كل مرحلة من الشغل حسب نوع مركزها ونوع المنتج
function sharesFor(stages: StageIn[], kinds: (string | null)[], type: string | null) {
  const split = STAGE_SPLIT[type ?? "other"] ?? STAGE_SPLIT.other;
  const byKind = new Map<string, number>();
  for (const [name, pct] of split) {
    const k = kindOf(name);
    if (k) byKind.set(k, (byKind.get(k) ?? 0) + pct);
  }
  // إذا أكثر من مرحلة بنفس النوع، تتقاسم النسبة
  const count = new Map<string, number>();
  kinds.forEach((k) => k && count.set(k, (count.get(k) ?? 0) + 1));
  const raw = stages.map((_, i) => {
    const k = kinds[i];
    return k && byKind.has(k) ? byKind.get(k)! / count.get(k)! : 0;
  });
  const sum = raw.reduce((a, b) => a + b, 0);
  return sum > 0 ? raw.map((r) => (r / sum) * 100) : stages.map(() => 100 / Math.max(1, stages.length));
}

// يوزع الساعات ويجدول المراحل وراء بعض من تاريخ البدء، ويتجاوز العطل
export function planOrder(o: { start: string; weightKg: number | null; type: string | null; estHours?: number | null }, stages: StageIn[], centers: Center[], off: number[], rates: Rates = DEFAULT_RATES): StagePlan[] {
  const byKind = new Map(centers.map((c) => [c.kind, c]));
  const byId = new Map(centers.map((c) => [c.id, c]));
  const center = (s: StageIn) => (s.work_center_id ? byId.get(s.work_center_id) : null) ?? (kindOf(s.name) ? byKind.get(kindOf(s.name)!) : undefined) ?? null;
  const cs = stages.map(center);
  const shares = sharesFor(stages, cs.map((c) => c?.kind ?? null), o.type);
  const total = orderHours(o.weightKg, o.type, rates, o.estHours);
  let cursor = nextWorkDay(o.start, off);
  return stages.map((s, i) => {
    const c = cs[i];
    const hours = Math.round(total * shares[i] / 100 * 10) / 10;
    if (!c || hours <= 0) return { id: s.id, work_center_id: c?.id ?? null, plan_hours: hours, weight_pct: Math.round(shares[i] * 10) / 10, plan_start: null, plan_end: null };
    // المرحلة المنجزة تبقى بتواريخها، والباقي ينجدول من المؤشر
    if (s.status === "done") return { id: s.id, work_center_id: c.id, plan_hours: hours, weight_pct: Math.round(shares[i] * 10) / 10, plan_start: s.plan_start ?? null, plan_end: s.plan_end ?? null };
    const days = Math.max(1, Math.ceil(hours / Math.max(0.5, dayCapacity(c))));
    const start = cursor;
    const end = addWorkDays(start, days, off);
    cursor = nextWorkDay(addDays(end, 1), off);
    return { id: s.id, work_center_id: c.id, plan_hours: hours, weight_pct: Math.round(shares[i] * 10) / 10, plan_start: start, plan_end: end };
  });
}

// التقدم بالوزن: مجموع حصة كل مرحلة × نسبة إنجازها
export type ProgStage = { status: string; progress: number | null; weight_pct: number | null };
export function weightProgress(stages: ProgStage[]) {
  if (!stages.length) return 0;
  const hasW = stages.some((s) => Number(s.weight_pct) > 0);
  const tot = hasW ? stages.reduce((a, s) => a + Number(s.weight_pct ?? 0), 0) : stages.length;
  const done = stages.reduce((a, s) => a + (hasW ? Number(s.weight_pct ?? 0) : 1) * (s.status === "done" ? 100 : Number(s.progress ?? 0)) / 100, 0);
  return tot > 0 ? Math.round((done / tot) * 100) : 0;
}

// الحمل اليومي على مركز العمل: الساعات الباقية تتوزع على أيام شغل المرحلة
export function centerLoad(stages: { work_center_id: string | null; plan_start: string | null; plan_end: string | null; plan_hours: number | null; progress: number | null; status: string }[], off: number[]) {
  const load = new Map<string, Map<string, number>>();
  for (const s of stages) {
    if (!s.work_center_id || !s.plan_start || !s.plan_end || !s.plan_hours || s.status === "done") continue;
    const left = Number(s.plan_hours) * (1 - Number(s.progress ?? 0) / 100);
    const n = workDaysBetween(s.plan_start, s.plan_end, off);
    if (!n || left <= 0) continue;
    const m = load.get(s.work_center_id) ?? new Map<string, number>();
    for (let d = s.plan_start; d <= s.plan_end; d = addDays(d, 1)) if (!isOff(d, off)) m.set(d, (m.get(d) ?? 0) + left / n);
    load.set(s.work_center_id, m);
  }
  return load;
}

// بداية الأسبوع (السبت) لتاريخ
export function weekStart(s: string) {
  const d = D(s).getUTCDay(); // 6 = السبت
  return addDays(s, -((d + 1) % 7));
}

// لون مركز العمل من ألوان المخططات الثابتة (6 ألوان + رمادي)
export const centerColor = (n: number | null | undefined) => (n != null && n >= 0 && n <= 5 ? `var(--nest-${n})` : "var(--muted)");
