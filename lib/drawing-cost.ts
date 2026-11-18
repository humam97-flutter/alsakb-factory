// من قطع المخطط ← ترتيب على الألواح ← كلفة المادة والقص والتصنيع ← الوقت بالمراحل
// يشتغل بالمتصفح (للمعاينة المباشرة) وبالسيرفر (وقت الحفظ) بنفس الحساب
import { cutTime, CUT_MACHINE, type CutRates } from "./cut-cost";
import type { Geom } from "./dxf-import";
import { paint } from "./engineering";
import { laborLines, STAGE_SPLIT, type Line, type Rates } from "./estimate";
import { kgOf, nest, type CutSettings, type Layout, type Part, type Plate } from "./nesting";
import { dayCapacity, kindOf, type Center } from "./planning";

export const JOB_TYPE: Record<string, string> = {
  cut_only: "قص فقط (الزبون ياخذ القطع)",
  structure: "هيكل حديدي (قص + تجميع + لحام + صبغ)",
  tank: "خزان",
  vessel: "وعاء ضغط",
  other: "أعمال حديد أخرى",
};

export type DrawPart = {
  key: string;
  name: string;
  shape: "rect" | "circle" | "ring" | "poly";
  w: number;
  h: number;
  diameter?: number;
  inner?: number;
  area: number;
  cutLen: number;
  pierces: number;
  holes: number;
  qty: number;
  thickness: number;
  grade: string;
  geom: Geom;
  include: boolean;
};

export type DrawInput = {
  parts: DrawPart[];
  sets: number;
  job: string;
  useStock: boolean;
  plates: Plate[];
  settings: CutSettings & { scrapPrice: number };
  cut: CutRates;
  rates: Rates;
  priceKg: number; // سعر كغم الصاج للألواح اللي تنشرى
  centers: Center[];
};

export type Group = { grade: string; thickness: number; netKg: number; plates: number; stock: number; buy: number; plateKg: number; remnantKg: number; scrapKg: number; cost: number; cutLen: number; pierces: number; cut: ReturnType<typeof cutTime> };
export type StageH = { name: string; hours: number; days: number };

const R = (x: number, d = 0) => Math.round(x * 10 ** d) / 10 ** d;

export function toNestPart(p: DrawPart, mult: number): Part {
  const round = p.shape === "circle" || p.shape === "ring";
  return {
    id: p.key,
    name: p.name,
    shape: round ? (p.shape as "circle" | "ring") : "rect",
    grade: p.grade,
    thickness: p.thickness,
    length_mm: round ? null : p.w,
    width_mm: round ? null : p.h,
    diameter_mm: round ? (p.diameter ?? p.w) : null,
    inner_mm: p.shape === "ring" ? (p.inner ?? null) : null,
    qty: Math.max(1, Math.round(p.qty)) * mult,
    area_mm2: p.shape === "poly" || (p.shape === "rect" && p.holes) ? p.area : null,
  };
}

export function costDrawing(inp: DrawInput) {
  const sets = Math.max(1, Math.round(inp.sets));
  const parts = inp.parts.filter((p) => p.include && p.qty > 0 && p.thickness > 0);
  const nestParts = parts.map((p) => toNestPart(p, sets));
  const { layouts, unplaced } = nest(nestParts, inp.useStock ? inp.plates : [], inp.settings);
  const byKey = new Map(parts.map((p) => [p.key, p]));

  // لكل نوع وسمك: الألواح والوزن والقص
  const groups = new Map<string, Group>();
  const gk = (g: string, t: number) => `${g.trim().toUpperCase()}|${t}`;
  for (const p of parts) {
    const k = gk(p.grade, p.thickness);
    const g = groups.get(k) ?? { grade: p.grade, thickness: p.thickness, netKg: 0, plates: 0, stock: 0, buy: 0, plateKg: 0, remnantKg: 0, scrapKg: 0, cost: 0, cutLen: 0, pierces: 0, cut: cutTime(inp.cut, p.thickness, 0, 0, 0) };
    const n = p.qty * sets;
    g.netKg += kgOf(p.area, p.thickness, 7.85) * n;
    g.cutLen += p.cutLen * n;
    g.pierces += p.pierces * n;
    groups.set(k, g);
  }
  for (const l of layouts) {
    const g = groups.get(gk(l.plate.grade, Number(l.plate.thickness)));
    if (!g) continue;
    g.plates++;
    if (l.virtual) g.buy++;
    else g.stock++;
    g.plateKg += l.plate_kg;
    g.remnantKg += l.remnant_kg;
    g.scrapKg += l.scrap_kg;
    // نفس معادلة مخطط القص: (اللوح ناقص البقية) × السعر، ناقص قيمة بيع السكراب
    const price = l.virtual || !Number(l.plate.price_kg) ? inp.priceKg : Number(l.plate.price_kg);
    g.cost += (l.plate_kg - l.remnant_kg) * price - l.scrap_kg * inp.settings.scrapPrice;
  }
  for (const g of groups.values()) g.cut = cutTime(inp.cut, g.thickness, g.cutLen, g.pierces, g.plates);

  const gs = [...groups.values()].sort((a, b) => a.thickness - b.thickness);
  const netKg = gs.reduce((a, g) => a + g.netKg, 0);
  const plateKg = gs.reduce((a, g) => a + g.plateKg, 0);
  const cutHours = gs.reduce((a, g) => a + g.cut.minutes, 0) / 60;
  const lines: Line[] = [];
  for (const g of gs) {
    const kg = g.plateKg - g.remnantKg;
    if (kg <= 0) continue;
    lines.push({
      category: "material",
      description: `صاج ${g.grade} سمك ${g.thickness} ملم: ${g.plates} لوح${g.stock ? ` (${g.stock} من المخزن${g.buy ? ` + ${g.buy} شراء` : ""})` : ""}، صافي ${R(g.netKg)} كغم، ناقص قيمة السكراب`,
      qty: R(kg),
      unit: "كغم",
      unit_cost: R(g.cost / kg, 0),
    });
  }
  for (const g of gs) {
    if (!g.cutLen) continue;
    lines.push({ category: "labor", description: `قص ${CUT_MACHINE[g.cut.machine]} سمك ${g.thickness}: ${R(g.cutLen / 1000, 1)} م قص، ${g.pierces} ثقب، ${g.plates} لوح`, qty: R(g.cut.minutes / 60, 1), unit: "ساعة", unit_cost: inp.rates.labor_hour });
    lines.push({ category: "other", description: `تشغيل ماكنة ${CUT_MACHINE[g.cut.machine]} (كهرباء وغاز ومستهلكات)`, qty: R(g.cut.minutes / 60, 1), unit: "ساعة ماكنة", unit_cost: inp.cut[`${g.cut.machine}_hour`] });
  }

  // مراحل الشغل والساعات
  const stages: { name: string; hours: number }[] = [{ name: "قص وتحضير", hours: R(Math.max(0.5, cutHours), 1) }];
  if (inp.job === "cut_only") {
    const handling = Math.max(1, (netKg / 1000) * 3); // تنظيف الحواف والفرز والتحميل: 3 ساعة لكل طن
    lines.push({ category: "labor", description: "تنظيف الحواف (Deburr) وفرز وتعليم القطع وتحميل", qty: R(handling, 1), unit: "ساعة", unit_cost: inp.rates.labor_hour });
    stages.push({ name: "تشطيب وفرز", hours: R(handling, 1) });
  } else {
    const type = inp.job;
    const other = laborLines(type, netKg / 1000, inp.rates).filter((l) => kindOf(l.description) !== "cut");
    lines.push(...other);
    for (const l of other) stages.push({ name: l.description, hours: l.qty });
    const elec = netKg * 0.02;
    lines.push({ category: "consumable", description: "أقطاب لحام (2% من الوزن)", qty: R(elec, 1), unit: "كغم", unit_cost: inp.rates.electrode_kg });
    lines.push({ category: "consumable", description: "غاز وأحجار جلخ", qty: 1, unit: "مقطوع", unit_cost: R(elec * inp.rates.electrode_kg * (inp.rates.consumables_pct / 100), -3) });
    // مساحة الصبغ من القطع نفسها: الوجهين
    const area = parts.reduce((a, p) => a + (2 * p.area * p.qty * sets) / 1e6, 0);
    lines.push({ category: "paint", description: `سفع رملي ${R(area, 1)} م²`, qty: R(area, 1), unit: "م²", unit_cost: inp.rates.blast_m2 });
    lines.push({ category: "paint", description: `صبغ ${R(area, 1)} م² طبقتين`, qty: R(paint(area, 75, 50, 30, 2).liters, 1), unit: "لتر", unit_cost: inp.rates.paint_l });
    lines.push({ category: "material", description: "براغي ومستلزمات (تقدير)", qty: 1, unit: "مقطوع", unit_cost: R(netKg * inp.rates.plate_kg * (inp.rates.accessories_pct / 100), -3) });
  }
  if (unplaced.length) lines.push({ category: "other", description: `قطع أكبر من الألواح القياسية (${unplaced.map((u) => u.part.name).join("، ")}): تنقص بلوح خاص أو تنلحم`, qty: 1, unit: "مقطوع", unit_cost: 0 });

  // الأيام: ساعات المرحلة ÷ طاقة مركز العمل باليوم
  const byKind = new Map(inp.centers.map((c) => [c.kind, c]));
  const stageDays: StageH[] = stages.map((s) => {
    const c = byKind.get(kindOf(s.name) ?? "") ?? null;
    return { ...s, days: Math.max(1, Math.ceil(s.hours / Math.max(0.5, c ? dayCapacity(c) : 8))) };
  });
  const direct = lines.reduce((a, l) => a + l.qty * l.unit_cost, 0);
  const cost = direct * (1 + inp.rates.overhead_pct / 100) * (1 + inp.rates.contingency_pct / 100);
  const price = Math.round((cost * (1 + inp.rates.margin_pct / 100)) / 1000) * 1000;
  return {
    layouts,
    unplaced,
    groups: gs,
    lines,
    stages: stageDays,
    byKey,
    totals: {
      netKg,
      plateKg,
      scrapKg: gs.reduce((a, g) => a + g.scrapKg, 0),
      remnantKg: gs.reduce((a, g) => a + g.remnantKg, 0),
      sheets: layouts.length,
      buy: layouts.filter((l) => l.virtual).length,
      yield: plateKg ? netKg / plateKg : 0,
      cutLen: gs.reduce((a, g) => a + g.cutLen, 0),
      pierces: gs.reduce((a, g) => a + g.pierces, 0),
      cutHours,
      hours: stageDays.reduce((a, s) => a + s.hours, 0),
      days: stageDays.reduce((a, s) => a + s.days, 0),
      direct,
      cost,
      price,
    },
  };
}

export type DrawResult = ReturnType<typeof costDrawing>;
export const stageNames = (job: string) => (job === "cut_only" ? ["قص وتحضير", "تشطيب وفرز", "تسليم"] : [...(STAGE_SPLIT[job] ?? STAGE_SPLIT.other).map(([n]) => (kindOf(n) === "cut" ? "قص وتحضير" : n)), "تسليم"]);
export type { Layout };
