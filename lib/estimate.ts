// التسعير التقديري: أسعار الكلف الافتراضية وتوليد البنود من الحساب الهندسي أو من الوزن
import { api650, paint, vessel, weld, type TankIn, type VesselIn } from "./engineering";

export type Rates = {
  plate_kg: number; // سعر كغم الصاج
  section_kg: number; // سعر كغم المقاطع (جسور، زوايا، شيلمان)
  waste_pct: number; // هدر القص المتوقع
  head_forming_kg: number; // أجور كبس الرؤوس لكل كغم (إذا تنكبس برة)
  accessories_pct: number; // فوهات وفلنجات وقواعد ومستلزمات كنسبة من المواد
  electrode_kg: number;
  consumables_pct: number; // غاز، أحجار جلخ، أوكسجين... كنسبة من أسلاك اللحام
  labor_hour: number; // كلفة ساعة العامل مع التأمين والإضافي
  paint_l: number;
  blast_m2: number; // سفع رملي لكل م²
  rt_film: number; // فلم أشعة
  pt_m: number; // صبغة نافذة لكل متر
  hydro: number; // اختبار مائي (مقطوع)
  docs: number; // ملف البيانات والشهادات
  transport: number;
  overhead_pct: number;
  contingency_pct: number;
  margin_pct: number;
  hours_vessel: number; // ساعة عمل لكل طن
  hours_tank: number;
  hours_structure: number;
  hours_other: number;
};

export const DEFAULT_RATES: Rates = {
  plate_kg: 1400,
  section_kg: 1250,
  waste_pct: 12,
  head_forming_kg: 700,
  accessories_pct: 8,
  electrode_kg: 4500,
  consumables_pct: 30,
  labor_hour: 6000,
  paint_l: 12000,
  blast_m2: 5000,
  rt_film: 25000,
  pt_m: 3000,
  hydro: 250000,
  docs: 150000,
  transport: 300000,
  overhead_pct: 12,
  contingency_pct: 5,
  margin_pct: 20,
  hours_vessel: 70,
  hours_tank: 30,
  hours_structure: 35,
  hours_other: 40,
};

export const RATE_LABELS: Record<keyof Rates, [string, string]> = {
  plate_kg: ["سعر كغم الصاج", "دينار"],
  section_kg: ["سعر كغم المقاطع (جسور، زوايا، شيلمان)", "دينار"],
  waste_pct: ["هدر القص المتوقع", "%"],
  head_forming_kg: ["أجور كبس الرؤوس لكل كغم", "دينار"],
  accessories_pct: ["فوهات وفلنجات وقواعد (نسبة من المواد)", "%"],
  electrode_kg: ["سعر كغم الأقطاب أو السلك", "دينار"],
  consumables_pct: ["غاز وأحجار وأوكسجين (نسبة من الأسلاك)", "%"],
  labor_hour: ["كلفة ساعة العمل", "دينار"],
  paint_l: ["سعر لتر الصبغ", "دينار"],
  blast_m2: ["سفع رملي لكل م²", "دينار"],
  rt_film: ["فلم أشعة RT", "دينار"],
  pt_m: ["صبغة نافذة PT لكل متر", "دينار"],
  hydro: ["الاختبار المائي (مقطوع)", "دينار"],
  docs: ["ملف البيانات والشهادات", "دينار"],
  transport: ["النقل (مقطوع)", "دينار"],
  overhead_pct: ["مصاريف عامة", "%"],
  contingency_pct: ["احتياط", "%"],
  margin_pct: ["هامش الربح", "%"],
  hours_vessel: ["ساعات العمل لكل طن: أوعية ضغط", "ساعة"],
  hours_tank: ["ساعات العمل لكل طن: خزانات", "ساعة"],
  hours_structure: ["ساعات العمل لكل طن: هياكل", "ساعة"],
  hours_other: ["ساعات العمل لكل طن: أعمال أخرى", "ساعة"],
};

export const CATEGORY: Record<string, string> = {
  material: "مواد",
  consumable: "مستهلكات اللحام",
  labor: "أجور العمل",
  ndt: "الفحوصات",
  paint: "الصبغ والسفع",
  subcontract: "أعمال خارجية",
  other: "أخرى",
};

export const PRODUCT_TYPE: Record<string, string> = { vessel: "وعاء ضغط", tank: "خزان نفطي", structure: "هيكل حديدي", other: "أعمال حديد أخرى" };

// توزيع ساعات العمل على المراحل (اللحام ينحسب من طول اللحام إذا متوفر)
export const STAGE_SPLIT: Record<string, [string, number][]> = {
  vessel: [["قص وتحضير الحواف", 10], ["درفلة", 10], ["تجميع وتركيب", 22], ["لحام", 35], ["جلخ وتشطيب", 10], ["فحص واختبار", 5], ["سفع وصبغ", 8]],
  tank: [["قص وتحضير الحواف", 10], ["درفلة", 12], ["تجميع وتركيب", 25], ["لحام", 33], ["جلخ وتشطيب", 8], ["فحص واختبار", 4], ["سفع وصبغ", 8]],
  structure: [["قص وتثقيب", 20], ["تجميع وتركيب", 30], ["لحام", 30], ["جلخ وتشطيب", 8], ["سفع وصبغ", 12]],
  other: [["قص وتحضير", 20], ["تجميع وتركيب", 25], ["لحام", 35], ["تشطيب وصبغ", 20]],
};

export function mergeRates(stored: unknown): Rates {
  const o = (stored && typeof stored === "object" ? stored : {}) as Partial<Record<keyof Rates, unknown>>;
  const r = { ...DEFAULT_RATES };
  for (const k of Object.keys(r) as (keyof Rates)[]) {
    const v = Number(o[k]);
    if (o[k] !== undefined && o[k] !== null && o[k] !== "" && Number.isFinite(v)) r[k] = v;
  }
  return r;
}

export type Line = { category: string; description: string; qty: number; unit: string; unit_cost: number };

const R = (x: number, d = 0) => Math.round(x * 10 ** d) / 10 ** d;

// ساعات العمل حسب المراحل
function laborLines(type: string, tons: number, rates: Rates, weldHours?: number): Line[] {
  const perTon = rates[`hours_${type}` as keyof Rates] ?? rates.hours_other;
  const total = tons * Number(perTon);
  const split = STAGE_SPLIT[type] ?? STAGE_SPLIT.other;
  const weldPct = split.find(([n]) => n === "لحام")?.[1] ?? 0;
  // إذا ساعات اللحام محسوبة، الباقي يتوزع حسب النسب
  const rest = weldHours != null ? Math.max(0, total * (1 - weldPct / 100)) : total;
  const restPct = weldHours != null ? 100 - weldPct : 100;
  return split.map(([name, pct]) => ({
    category: "labor",
    description: name,
    qty: name === "لحام" && weldHours != null ? R(Math.max(weldHours, 1)) : R((rest * pct) / restPct),
    unit: "ساعة",
    unit_cost: rates.labor_hour,
  }));
}

export type Source =
  | { kind: "vessel"; inp: VesselIn; grade: string; joint: string }
  | { kind: "tank"; inp: TankIn; grade: string }
  | { kind: "weight"; type: string; kg: number; plates: boolean };

export function buildLines(src: Source, rates: Rates): { lines: Line[]; weightKg: number } {
  const lines: Line[] = [];
  const waste = 1 + rates.waste_pct / 100;
  if (src.kind === "vessel") {
    const r = vessel(src.inp);
    const shellBuy = r.shellKg * waste;
    const headBuy = r.headBlankKg * 2;
    lines.push({ category: "material", description: `صاج الجسم ${src.grade} سمك ${r.tShell} ملم (مع هدر ${rates.waste_pct}%)`, qty: R(shellBuy), unit: "كغم", unit_cost: rates.plate_kg });
    lines.push({ category: "material", description: `صاج الرأسين سمك ${r.tHead} ملم: قرصين Ø${r.blank}`, qty: R(headBuy * 1.08), unit: "كغم", unit_cost: rates.plate_kg });
    lines.push({ category: "material", description: "فوهات وفلنجات وقواعد وحلقات تقوية (تقدير)", qty: 1, unit: "مقطوع", unit_cost: R((shellBuy + headBuy) * rates.plate_kg * (rates.accessories_pct / 100), -3) });
    if (src.inp.head !== "flat") lines.push({ category: "subcontract", description: "كبس الرأسين", qty: R(headBuy), unit: "كغم", unit_cost: rates.head_forming_kg });
    const w = weld(r.longLen + r.circLen, r.tShell, "smaw");
    lines.push({ category: "consumable", description: `أقطاب لحام (${Math.round((r.longLen + r.circLen) / 1000)} م لحام)`, qty: R(w.consumable * 1.15, 1), unit: "كغم", unit_cost: rates.electrode_kg });
    lines.push({ category: "consumable", description: "غاز وأحجار جلخ وقطع وأوكسجين", qty: 1, unit: "مقطوع", unit_cost: R(w.consumable * 1.15 * rates.electrode_kg * (rates.consumables_pct / 100), -3) });
    lines.push(...laborLines("vessel", r.emptyKg / 1000, rates, w.hours * 1.15));
    const films = src.joint === "full" ? Math.ceil((r.longLen + r.circLen) / 300) : src.joint === "spot" ? Math.ceil(((r.longLen + r.circLen) / 300) * 0.1) + 2 : 0;
    if (films) lines.push({ category: "ndt", description: src.joint === "full" ? "أشعة كاملة RT" : "أشعة نقطية RT", qty: films, unit: "فلم", unit_cost: rates.rt_film });
    lines.push({ category: "ndt", description: "صبغة نافذة PT للفوهات والزوايا", qty: R(Math.PI * r.OD * 4 / 1000 + 5), unit: "متر", unit_cost: rates.pt_m });
    lines.push({ category: "ndt", description: `اختبار مائي على ${R(r.hydro * 10, 1)} بار`, qty: 1, unit: "مقطوع", unit_cost: rates.hydro });
    const p = paint(r.areaOut, 75, 50, 30, 3);
    lines.push({ category: "paint", description: `سفع رملي ${R(r.areaOut, 1)} م²`, qty: R(r.areaOut, 1), unit: "م²", unit_cost: rates.blast_m2 });
    lines.push({ category: "paint", description: "صبغ: برايمر + وسطى + نهائي", qty: R(p.liters), unit: "لتر", unit_cost: rates.paint_l });
    lines.push({ category: "other", description: "ملف البيانات والشهادات ولوحة الاسم", qty: 1, unit: "مقطوع", unit_cost: rates.docs });
    lines.push({ category: "other", description: "النقل", qty: 1, unit: "مقطوع", unit_cost: rates.transport });
    return { lines, weightKg: R(r.emptyKg) };
  }
  if (src.kind === "tank") {
    const r = api650(src.inp);
    const t = src.inp;
    lines.push({ category: "material", description: `صاج الجدار ${src.grade} (${r.courses.map((c) => c.t).join("/")} ملم، مع هدر ${rates.waste_pct}%)`, qty: R(r.shellKg * waste), unit: "كغم", unit_cost: rates.plate_kg });
    lines.push({ category: "material", description: `صاج القاع سمك ${r.tBottom} ملم`, qty: R(r.bottomKg * waste), unit: "كغم", unit_cost: rates.plate_kg });
    lines.push({ category: "material", description: `صاج السقف سمك ${r.tRoof} ملم`, qty: R(r.roofKg * waste), unit: "كغم", unit_cost: rates.plate_kg });
    lines.push({ category: "material", description: "هيكل السقف وحلقة الرياح والسلم والدرابزين (تقدير 20% من السقف + 600 كغم)", qty: R(r.roofKg * 0.2 + 600), unit: "كغم", unit_cost: rates.section_kg });
    lines.push({ category: "material", description: "فوهات وفتحات تفتيش وفلنجات (تقدير)", qty: 1, unit: "مقطوع", unit_cost: R(r.totalKg * rates.plate_kg * (rates.accessories_pct / 100), -3) });
    const vert = r.courses.reduce((a, c) => a + c.w * r.perCourse, 0);
    const horiz = (r.courses.length - 1) * r.circ;
    const bottomSeams = (((Math.PI / 4) * r.bottomD ** 2) / (t.plateL * t.plateW)) * (t.plateL + t.plateW);
    const len = vert + horiz + 2 * r.circ + bottomSeams + r.circ;
    const avgT = r.courses.reduce((a, c) => a + c.t, 0) / r.courses.length;
    const w = weld(len, avgT, "smaw");
    lines.push({ category: "consumable", description: `أقطاب لحام (${Math.round(len / 1000)} م لحام)`, qty: R(w.consumable * 1.15, 1), unit: "كغم", unit_cost: rates.electrode_kg });
    lines.push({ category: "consumable", description: "غاز وأحجار جلخ وقطع وأوكسجين", qty: 1, unit: "مقطوع", unit_cost: R(w.consumable * 1.15 * rates.electrode_kg * (rates.consumables_pct / 100), -3) });
    lines.push(...laborLines("tank", r.totalKg / 1000, rates, w.hours * 1.15));
    lines.push({ category: "ndt", description: "أشعة نقطية RT للجدار (API 650 بند 8.1)", qty: Math.ceil(vert / 1000 / 30 + horiz / 1000 / 60) + r.courses.length, unit: "فلم", unit_cost: rates.rt_film });
    lines.push({ category: "ndt", description: "فحص فراغ (Vacuum box) للقاع واختبار مائي بالماي", qty: 1, unit: "مقطوع", unit_cost: rates.hydro * 2 });
    const p = paint(r.areaOut, 75, 50, 30, 3);
    lines.push({ category: "paint", description: `سفع رملي ${R(r.areaOut)} م² (الخارج)`, qty: R(r.areaOut), unit: "م²", unit_cost: rates.blast_m2 });
    lines.push({ category: "paint", description: "صبغ خارجي 3 طبقات", qty: R(p.liters), unit: "لتر", unit_cost: rates.paint_l });
    lines.push({ category: "other", description: "النقل والرفع", qty: 1, unit: "مقطوع", unit_cost: rates.transport * 2 });
    return { lines, weightKg: R(r.totalKg) };
  }
  // من الوزن فقط (هياكل وأعمال مختلفة)
  const kg = src.kg;
  const type = src.type;
  lines.push({ category: "material", description: `${src.plates ? "صاج" : "مقاطع حديد"} (مع هدر ${rates.waste_pct}%)`, qty: R(kg * waste), unit: "كغم", unit_cost: src.plates ? rates.plate_kg : rates.section_kg });
  lines.push({ category: "material", description: "براغي وصواميل ومستلزمات (تقدير)", qty: 1, unit: "مقطوع", unit_cost: R(kg * rates.section_kg * (rates.accessories_pct / 100), -3) });
  const elec = kg * 0.02;
  lines.push({ category: "consumable", description: "أقطاب لحام (2% من الوزن)", qty: R(elec, 1), unit: "كغم", unit_cost: rates.electrode_kg });
  lines.push({ category: "consumable", description: "غاز وأحجار جلخ وقطع", qty: 1, unit: "مقطوع", unit_cost: R(elec * rates.electrode_kg * (rates.consumables_pct / 100), -3) });
  lines.push(...laborLines(type, kg / 1000, rates));
  const area = (kg / 1000) * 30; // م² لكل طن تقريباً
  const p = paint(area, 75, 50, 30, 2);
  lines.push({ category: "paint", description: `صبغ ${R(area)} م² طبقتين`, qty: R(p.liters), unit: "لتر", unit_cost: rates.paint_l });
  lines.push({ category: "other", description: "النقل", qty: 1, unit: "مقطوع", unit_cost: rates.transport });
  return { lines, weightKg: R(kg) };
}

export const EST_STATUS: Record<string, { label: string; tone: string }> = {
  draft: { label: "مسودة", tone: "mut" },
  quoted: { label: "انرسل عرض", tone: "info" },
  won: { label: "انربح", tone: "ok" },
  lost: { label: "ما انربح", tone: "bad" },
};
