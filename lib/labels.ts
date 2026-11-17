export const ROLE: Record<string, string> = {
  manager: "المدير",
  production: "مدير الإنتاج",
  storekeeper: "أمين المخزن",
  accountant: "المحاسب",
  operator: "مشغل / عامل",
};

export type Tone = "ok" | "warn" | "bad" | "info" | "mut";
type Opt = { label: string; tone: Tone };

export const ORDER_STATUS: Record<string, Opt> = {
  new: { label: "جديد", tone: "info" },
  in_progress: { label: "قيد التنفيذ", tone: "warn" },
  on_hold: { label: "متوقف", tone: "bad" },
  done: { label: "مكتمل", tone: "ok" },
  delivered: { label: "تم التسليم", tone: "mut" },
  cancelled: { label: "ملغي", tone: "mut" },
};

export const PRIORITY: Record<string, Opt> = {
  normal: { label: "عادية", tone: "mut" },
  high: { label: "عالية", tone: "warn" },
  urgent: { label: "عاجلة", tone: "bad" },
};

export const MACHINE_STATUS: Record<string, Opt> = {
  running: { label: "تعمل", tone: "ok" },
  idle: { label: "متوقفة", tone: "mut" },
  maintenance: { label: "صيانة", tone: "warn" },
  broken: { label: "عاطلة", tone: "bad" },
};

export const STAGE_STATUS: Record<string, Opt> = {
  waiting: { label: "بالانتظار", tone: "mut" },
  working: { label: "قيد العمل", tone: "warn" },
  done: { label: "منجزة", tone: "ok" },
};

export const ATTENDANCE: Record<string, Opt> = {
  present: { label: "حاضر", tone: "ok" },
  half: { label: "نصف يوم", tone: "info" },
  absent: { label: "غائب", tone: "bad" },
  leave: { label: "إجازة", tone: "warn" },
};

export const PAYMENT: Record<string, Opt> = {
  advance: { label: "سلفة", tone: "warn" },
  bonus: { label: "مكافأة", tone: "ok" },
  deduction: { label: "خصم", tone: "bad" },
  salary: { label: "دفع راتب", tone: "info" },
};

export const MOVE: Record<string, Opt> = {
  issue: { label: "صرف", tone: "warn" },
  receive: { label: "استلام", tone: "ok" },
  adjust: { label: "تسوية جرد", tone: "info" },
};

export const MAINT_KIND: Record<string, Opt> = {
  periodic: { label: "دورية", tone: "info" },
  breakdown: { label: "عطل", tone: "bad" },
  part: { label: "تبديل قطعة", tone: "warn" },
  inspection: { label: "فحص", tone: "mut" },
};

export const MAINT_STATE: Record<string, Opt> = {
  open: { label: "مفتوحة", tone: "bad" },
  working: { label: "قيد العمل", tone: "warn" },
  done: { label: "منجزة", tone: "ok" },
};

export const UNITS = ["قطعة", "طن", "كغم", "متر", "لفة", "علبة", "خزان", "مجموعة"];
export const MATERIAL_KINDS = ["لوح", "أنبوب", "مقطع", "لفة", "عمود", "قطع غيار", "لحام وغازات", "أخرى"];
export const JOBS = ["مشغل ليزر", "مشغل بلازما", "مشغل ثني", "مشغل درفلة", "لحام", "خراط", "مجمع / فيتر", "عامل", "مشرف", "مهندس", "أخرى"];
export const CURRENCIES: Record<string, string> = { IQD: "دينار", USD: "دولار" };

export function money(n: number | string | null | undefined, currency = "IQD") {
  if (n === null || n === undefined || n === "") return "—";
  const s = Number(n).toLocaleString("en-US", { maximumFractionDigits: currency === "USD" ? 2 : 0 });
  return currency === "USD" ? `$${s}` : `${s} د.ع`;
}

export function num(n: number | string | null | undefined) {
  if (n === null || n === undefined || n === "") return "—";
  return Number(n).toLocaleString("en-US", { maximumFractionDigits: 3 });
}

export const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Baghdad" });

export const DOC_KIND: Record<string, Opt> = {
  incoming: { label: "كتاب وارد", tone: "info" },
  outgoing: { label: "كتاب صادر", tone: "ok" },
  contract: { label: "عقد", tone: "warn" },
  official: { label: "مستند رسمي", tone: "mut" },
  other: { label: "أخرى", tone: "mut" },
};

export const DOC_STATUS: Record<string, Opt> = {
  pending: { label: "بانتظار إجراء", tone: "warn" },
  done: { label: "منجز", tone: "ok" },
  archived: { label: "مؤرشف", tone: "mut" },
};

export const labelsOf = (m: Record<string, { label: string }>) =>
  Object.fromEntries(Object.entries(m).map(([k, v]) => [k, v.label]));

export function addDays(day: string, n: number) {
  const d = new Date(day + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function fileSize(n: number | null | undefined) {
  if (!n) return "";
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} ك.ب`;
  return `${(n / 1024 / 1024).toFixed(1)} م.ب`;
}

export const QUOTE_STATUS: Record<string, Opt> = {
  draft: { label: "مسودة", tone: "mut" },
  sent: { label: "مُرسل", tone: "info" },
  accepted: { label: "مقبول", tone: "ok" },
  rejected: { label: "مرفوض", tone: "bad" },
};

export const PAY_METHOD: Record<string, string> = { cash: "نقد", transfer: "حوالة", cheque: "صك" };
export const LINE_UNITS = ["قطعة", "كغم", "طن", "متر", "م²", "ساعة", "مقطوعة"];

export const REQUEST_STATUS: Record<string, Opt> = {
  pending: { label: "بانتظار الموافقة", tone: "warn" },
  approved: { label: "موافق عليه", tone: "info" },
  rejected: { label: "مرفوض", tone: "bad" },
  bought: { label: "تم الشراء", tone: "ok" },
};

export const EXPENSE_CATEGORIES = ["إيجار", "كهرباء وطنية", "مولدة ووقود", "غاز وأوكسجين", "نقل وتحميل", "ضيافة", "صيانة مبنى", "رواتب إدارية", "ضرائب ورسوم", "اتصالات وإنترنت", "أخرى"];
export const CASH_KIND: Record<string, string> = { opening: "رصيد افتتاحي", deposit: "إيداع", withdraw: "سحب", exchange: "تصريف عملة" };

export const QC_RESULT: Record<string, Opt> = {
  pass: { label: "مقبول", tone: "ok" },
  rework: { label: "يحتاج تصليح", tone: "warn" },
  fail: { label: "مرفوض", tone: "bad" },
};
export const QC_ITEMS = ["الأبعاد والقياسات", "اللحام", "الاستقامة والتشطيب", "الصبغ", "العدد والكمية", "التغليف والتعليم"];
