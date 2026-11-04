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

export const today = () => new Date().toISOString().slice(0, 10);
