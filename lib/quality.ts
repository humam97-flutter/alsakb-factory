export const WELD_KIND: Record<string, string> = { long: "طولي", circ: "محيطي", nozzle: "فوهة", fillet: "زاوية (Fillet)", other: "أخرى" };
export const WELD_PREFIX: Record<string, string> = { long: "L", circ: "C", nozzle: "N", fillet: "F", other: "W" };
export const WELD_STATUS: Record<string, { label: string; tone: "mut" | "info" | "ok" | "bad" }> = {
  pending: { label: "ما انلحم", tone: "mut" },
  welded: { label: "انلحم، ينتظر الفحص", tone: "info" },
  accepted: { label: "مقبول", tone: "ok" },
  repair: { label: "يحتاج تصليح", tone: "bad" },
};
export const NDT_METHODS: Record<string, string> = { RT: "أشعة RT", UT: "ألتراسوني UT", PT: "صبغة نافذة PT", MT: "جزيئات مغناطيسية MT", VT: "فحص بصري VT" };
export const PROCESSES = ["SMAW", "GTAW", "GTAW+SMAW", "SAW", "FCAW", "GMAW"];
export const NCR_SOURCE: Record<string, string> = { internal: "داخلي", customer: "من الزبون", supplier: "من المورد" };

// حالة مؤهل اللحام حسب تاريخ الانتهاء
export function qualState(expires: string | null, today: string, soon: string): { label: string; tone: "ok" | "warn" | "bad" | "mut" } {
  if (!expires) return { label: "بدون تاريخ", tone: "mut" };
  if (expires < today) return { label: "منتهي", tone: "bad" };
  if (expires <= soon) return { label: "ينتهي قريباً", tone: "warn" };
  return { label: "ساري", tone: "ok" };
}
