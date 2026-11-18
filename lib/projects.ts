// المشاريع والدفعات: التسميات وحساب الدفعة والمحتجز والسلفة
// النسب الافتراضية (محتجز 5%، سلفة 0%) يراجعها المهندس أو المحاسب حسب العقد

export const PROJECT_STATUS: Record<string, { label: string; tone: "ok" | "warn" | "info" | "mut" | "bad" }> = {
  active: { label: "قيد التنفيذ", tone: "info" },
  hold: { label: "متوقف", tone: "warn" },
  done: { label: "منجز", tone: "ok" },
  cancelled: { label: "ملغي", tone: "mut" },
};

export const MILESTONE_KIND: Record<string, string> = { advance: "سلفة مقدمة", progress: "دفعة إنجاز", delivery: "تسليم", retention: "إطلاق المحتجز" };

export const MS_STATE: Record<string, { label: string; tone: "ok" | "warn" | "info" | "mut" | "bad" }> = {
  pending: { label: "ما استحقت", tone: "mut" },
  due: { label: "مستحقة، افوترها", tone: "warn" },
  overdue: { label: "متأخرة", tone: "bad" },
  invoiced: { label: "مفوترة", tone: "info" },
  paid: { label: "مستلمة", tone: "ok" },
};

export const GUARANTEE_KIND: Record<string, string> = { bid: "دخول مناقصة", performance: "حسن تنفيذ", advance: "سلفة", retention: "بدل المحتجز", warranty: "صيانة/ضمان" };
export const GUARANTEE_STATUS: Record<string, { label: string; tone: "ok" | "warn" | "info" | "mut" | "bad" }> = {
  active: { label: "سارية", tone: "info" },
  released: { label: "مستردة", tone: "ok" },
  claimed: { label: "مصادرة", tone: "bad" },
};

export const TENDER_STATUS: Record<string, { label: string; tone: "ok" | "warn" | "info" | "mut" | "bad" }> = {
  preparing: { label: "قيد التحضير", tone: "warn" },
  submitted: { label: "مقدمة", tone: "info" },
  won: { label: "فزنا", tone: "ok" },
  lost: { label: "خسرنا", tone: "bad" },
  cancelled: { label: "ملغاة", tone: "mut" },
};

// جدول الدفعات الافتراضي: دفعات الإنجاز مجموعها 100% من العقد، والسلفة فوقها وتنسترد منها بنفس نسبتها
export const DEFAULT_MILESTONES: { name: string; kind: string; pct: number; trigger?: number }[] = [
  { name: "دفعة مقدمة عند توقيع العقد", kind: "advance", pct: 20 },
  { name: "عند وصول المواد وبدء التصنيع", kind: "progress", pct: 25, trigger: 15 },
  { name: "عند إنجاز 50% من التصنيع", kind: "progress", pct: 30, trigger: 50 },
  { name: "عند اجتياز الفحص والاختبار", kind: "progress", pct: 25, trigger: 90 },
  { name: "عند التسليم والنصب", kind: "delivery", pct: 20, trigger: 100 },
  { name: "إطلاق المحتجز بعد فترة الضمان", kind: "retention", pct: 0 },
];

export type Proj = { contract_value: number; retention_pct: number; advance_pct: number };
export type Ms = { kind: string; pct: number; status: string; invoice_id: string | null };

// بنود فاتورة الدفعة: المبلغ، ناقص المحتجز، ناقص استرداد السلفة
export function milestoneLines(p: Proj, m: Pick<Ms, "kind" | "pct">, retentionHeld: number, name: string) {
  const cv = Number(p.contract_value);
  if (m.kind === "retention") {
    return [{ description: `${name}`, amount: retentionHeld }];
  }
  const gross = (cv * Number(m.pct)) / 100;
  if (m.kind === "advance") return [{ description: `${name} (${Number(m.pct)}% من قيمة العقد)`, amount: gross }];
  const lines = [{ description: `${name} (${Number(m.pct)}% من قيمة العقد)`, amount: gross }];
  if (Number(p.retention_pct) > 0) lines.push({ description: `يُطرح المحتجز ${Number(p.retention_pct)}%`, amount: -(gross * Number(p.retention_pct)) / 100 });
  if (Number(p.advance_pct) > 0) lines.push({ description: `يُطرح استرداد السلفة ${Number(p.advance_pct)}%`, amount: -(gross * Number(p.advance_pct)) / 100 });
  return lines;
}

// المحتجز المتراكم: من كل دفعة إنجاز أو تسليم مفوترة، ناقص اللي انطلق
export function retentionHeld(p: Proj, ms: Ms[]) {
  const held = ms
    .filter((m) => (m.kind === "progress" || m.kind === "delivery") && m.status !== "pending")
    .reduce((a, m) => a + (Number(p.contract_value) * Number(m.pct) * Number(p.retention_pct)) / 10000, 0);
  const released = ms.some((m) => m.kind === "retention" && m.status !== "pending");
  return released ? 0 : held;
}

// السلفة الباقية بذمتنا: المستلمة ناقص المسترد من الدفعات
export function advanceOutstanding(p: Proj, ms: Ms[]) {
  const adv = ms.filter((m) => m.kind === "advance" && m.status !== "pending").reduce((a, m) => a + (Number(p.contract_value) * Number(m.pct)) / 100, 0);
  const rec = ms
    .filter((m) => (m.kind === "progress" || m.kind === "delivery") && m.status !== "pending")
    .reduce((a, m) => a + (Number(p.contract_value) * Number(m.pct) * Number(p.advance_pct)) / 10000, 0);
  return Math.max(0, adv - rec);
}

// حالة الدفعة: من الفاتورة، أو من إنجاز الأمر المربوط، أو من التاريخ
export function milestoneState(m: { status: string; trigger_progress: number | null; due_date: string | null }, inv: { balance: number } | undefined, orderProgress: number | undefined, today: string) {
  if (m.status !== "pending") return inv && Number(inv.balance) <= 0 ? "paid" : "invoiced";
  if (m.due_date && m.due_date < today) return "overdue";
  // orderProgress: إنجاز الأمر المربوط، أو إنجاز المشروع كله إذا ما مربوطة بأمر
  if (m.trigger_progress != null && orderProgress != null && orderProgress >= m.trigger_progress) return "due";
  if (m.due_date && m.due_date <= today) return "due";
  return "pending";
}
