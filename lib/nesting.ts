// ترتيب القطع على الألواح (Nesting) وحساب الهدر
// الخوارزمية: MaxRects مع تدوير القطعة 90°، أفضل تطابق للضلع القصير، والقطع الكبيرة أولاً.
// الدائرة والحلقة تاخذ مربع بقدر قطرها، لكن وزنها يُحسب على مساحتها الحقيقية.

export type PartShape = "rect" | "circle" | "ring";
export type Part = {
  id: string;
  name: string;
  shape: PartShape;
  grade: string;
  thickness: number;
  length_mm: number | null;
  width_mm: number | null;
  diameter_mm: number | null;
  inner_mm: number | null;
  qty: number;
  area_mm2?: number | null; // لقطعة من مخطط DXF: المساحة الحقيقية (الشكل يترتب بالمستطيل المحيط)
};
export type Plate = {
  id: string;
  serial: number;
  grade: string;
  thickness: number;
  length_mm: number;
  width_mm: number;
  density: number;
  price_kg: number;
  parent_id: string | null;
  location?: string | null;
};
export type Placed = { part_id: string; name: string; shape: PartShape; x: number; y: number; w: number; h: number; d?: number; inner?: number; rot: boolean };
export type Rect = { x: number; y: number; w: number; h: number };
export type Layout = {
  plate: Plate;
  virtual: boolean; // لوح قياسي مقترح للشراء (مو موجود بالمخزن)
  placed: Placed[];
  remnants: Rect[];
  plate_kg: number;
  parts_kg: number;
  remnant_kg: number;
  scrap_kg: number;
  yield: number; // نسبة الاستغلال من وزن اللوح
};
export type CutSettings = { kerf: number; edge: number; minRemnant: number; sizes: [number, number][] };

const EPS = 1e-6;

// أبعاد القطعة بالملم (المستطيل اللي تحتاجه على اللوح)
export function partBox(p: Part): [number, number] {
  if (p.shape === "rect") return [Number(p.length_mm), Number(p.width_mm)];
  return [Number(p.diameter_mm), Number(p.diameter_mm)];
}

// المساحة الحقيقية بالملم²
export function partArea(p: Pick<Part, "shape" | "length_mm" | "width_mm" | "diameter_mm" | "inner_mm"> & { area_mm2?: number | null }): number {
  if (p.area_mm2 && Number(p.area_mm2) > 0) return Number(p.area_mm2);
  if (p.shape === "rect") return Number(p.length_mm) * Number(p.width_mm);
  const d = Number(p.diameter_mm);
  const i = p.shape === "ring" ? Number(p.inner_mm ?? 0) : 0;
  return (Math.PI / 4) * (d * d - i * i);
}

export const kgOf = (areaMm2: number, thickness: number, density: number) => (areaMm2 * thickness * density) / 1e6;

export function parseSizes(s: string | null | undefined): [number, number][] {
  return String(s ?? "")
    .split(/[,،\n]/)
    .map((x) => x.split(/[x×*]/i).map((n) => Number(n.trim())))
    .filter((a) => a.length === 2 && a[0] > 0 && a[1] > 0)
    .map(([a, b]) => [Math.max(a, b), Math.min(a, b)] as [number, number]);
}

// ---------- MaxRects ----------
class Bin {
  free: Rect[];
  constructor(public W: number, public H: number) {
    this.free = W > 0 && H > 0 ? [{ x: 0, y: 0, w: W, h: H }] : [];
  }
  // أفضل مكان: أقل فضلة بالضلع القصير، ثم الطويل
  find(w: number, h: number, canRotate: boolean) {
    let best: { x: number; y: number; w: number; h: number; rot: boolean; s1: number; s2: number } | null = null;
    for (const f of this.free) {
      for (const rot of canRotate && Math.abs(w - h) > EPS ? [false, true] : [false]) {
        const pw = rot ? h : w, ph = rot ? w : h;
        if (pw <= f.w + EPS && ph <= f.h + EPS) {
          const dw = f.w - pw, dh = f.h - ph;
          const s1 = Math.min(dw, dh), s2 = Math.max(dw, dh);
          if (!best || s1 < best.s1 - EPS || (Math.abs(s1 - best.s1) < EPS && s2 < best.s2)) best = { x: f.x, y: f.y, w: pw, h: ph, rot, s1, s2 };
        }
      }
    }
    return best;
  }
  place(r: Rect) {
    const next: Rect[] = [];
    for (const f of this.free) {
      if (r.x >= f.x + f.w - EPS || r.x + r.w <= f.x + EPS || r.y >= f.y + f.h - EPS || r.y + r.h <= f.y + EPS) {
        next.push(f);
        continue;
      }
      if (r.x > f.x + EPS) next.push({ x: f.x, y: f.y, w: r.x - f.x, h: f.h });
      if (r.x + r.w < f.x + f.w - EPS) next.push({ x: r.x + r.w, y: f.y, w: f.x + f.w - r.x - r.w, h: f.h });
      if (r.y > f.y + EPS) next.push({ x: f.x, y: f.y, w: f.w, h: r.y - f.y });
      if (r.y + r.h < f.y + f.h - EPS) next.push({ x: f.x, y: r.y + r.h, w: f.w, h: f.y + f.h - r.y - r.h });
    }
    // نشيل المستطيلات المحتواة داخل غيرها
    this.free = next.filter(
      (a, i) => !next.some((b, j) => j !== i && a.x >= b.x - EPS && a.y >= b.y - EPS && a.x + a.w <= b.x + b.w + EPS && a.y + a.h <= b.y + b.h + EPS && (j < i || a.w * a.h < b.w * b.h - EPS)),
    );
  }
}

type Unit = { part: Part; w: number; h: number; area: number };

// يرتب أكبر عدد من القطع على لوح واحد؛ يرجع المرصوف والباقي
function packPlate(plate: Plate, units: Unit[], s: CutSettings) {
  const L = Number(plate.length_mm), W = Number(plate.width_mm);
  const bin = new Bin(L - 2 * s.edge + s.kerf, W - 2 * s.edge + s.kerf); // آخر قطعة ما تحتاج خط قص بعدها
  const placed: Placed[] = [];
  const rest: Unit[] = [];
  for (const u of units) {
    const spot = bin.find(u.w + s.kerf, u.h + s.kerf, true);
    if (!spot) {
      rest.push(u);
      continue;
    }
    bin.place({ x: spot.x, y: spot.y, w: spot.w, h: spot.h });
    const p = u.part;
    placed.push({
      part_id: p.id,
      name: p.name,
      shape: p.shape,
      x: spot.x + s.edge,
      y: spot.y + s.edge,
      w: spot.w - s.kerf,
      h: spot.h - s.kerf,
      ...(p.shape !== "rect" ? { d: Number(p.diameter_mm) } : {}),
      ...(p.shape === "ring" ? { inner: Number(p.inner_mm) } : {}),
      rot: spot.rot,
    });
  }
  return { placed, rest, free: bin.free };
}

// البقايا: أكبر المساحات الفارغة غير المتداخلة اللي ضلعها الأصغر ≥ الحد الأدنى، ممدودة لحافة اللوح
function pickRemnants(plate: Plate, free: Rect[], s: CutSettings): Rect[] {
  const L = Number(plate.length_mm), W = Number(plate.width_mm);
  const ux = L - 2 * s.edge + s.kerf, uy = W - 2 * s.edge + s.kerf;
  const cands = free
    .map((f) => {
      let x = f.x + s.edge, y = f.y + s.edge, w = f.w - s.kerf, h = f.h - s.kerf;
      if (f.x < EPS) { x = 0; w += s.edge; }
      if (f.y < EPS) { y = 0; h += s.edge; }
      if (Math.abs(f.x + f.w - ux) < EPS) w = L - x;
      if (Math.abs(f.y + f.h - uy) < EPS) h = W - y;
      return { x, y, w, h };
    })
    .filter((r) => Math.min(r.w, r.h) >= s.minRemnant - EPS)
    .sort((a, b) => b.w * b.h - a.w * a.h);
  const out: Rect[] = [];
  for (const r of cands) {
    if (out.some((o) => r.x < o.x + o.w - EPS && r.x + r.w > o.x + EPS && r.y < o.y + o.h - EPS && r.y + r.h > o.y + EPS)) continue;
    out.push(r);
    if (out.length >= 3) break;
  }
  return out;
}

function summarize(plate: Plate, placed: Placed[], remnants: Rect[], parts: Map<string, Part>, virtual: boolean): Layout {
  const t = Number(plate.thickness), dens = Number(plate.density);
  const plate_kg = kgOf(Number(plate.length_mm) * Number(plate.width_mm), t, dens);
  const parts_kg = placed.reduce((a, p) => a + kgOf(partArea(parts.get(p.part_id)!), t, dens), 0);
  const remnant_kg = remnants.reduce((a, r) => a + kgOf(r.w * r.h, t, dens), 0);
  const scrap_kg = Math.max(0, plate_kg - parts_kg - remnant_kg);
  return { plate, virtual, placed, remnants, plate_kg, parts_kg, remnant_kg, scrap_kg, yield: plate_kg > 0 ? parts_kg / plate_kg : 0 };
}

export const groupKey = (grade: string, thickness: number) => `${grade.trim().toUpperCase()}|${Number(thickness)}`;

// الخطة الكاملة: لكل نوع وسمك، نختار كل مرة اللوح اللي يعطي أعلى استغلال (البقايا تدخل بالمنافسة)،
// وإذا خلصت الألواح نقترح ألواح قياسية للشراء
type Order = (a: Unit, b: Unit) => number;
const ORDERS: Order[] = [
  (a, b) => Math.max(b.w, b.h) - Math.max(a.w, a.h) || b.area - a.area, // الضلع الأطول أولاً
  (a, b) => b.area - a.area, // المساحة الأكبر أولاً
  (a, b) => Math.min(b.w, b.h) - Math.min(a.w, a.h) || b.area - a.area, // الضلع الأقصر أولاً
];
type Result = { layouts: Layout[]; unplaced: { part: Part; qty: number }[] };

// نجرب أكثر من ترتيب ونختار اللي يعطي أقل ألواح جديدة ثم أقل هدر
export function nest(parts: Part[], plates: Plate[], s: CutSettings): Result {
  let best: Result | null = null;
  let bestKey: number[] = [];
  for (const o of ORDERS) {
    const r = nestOnce(parts, plates, s, o);
    const key = [
      r.unplaced.reduce((a, u) => a + u.qty, 0),
      r.layouts.filter((l) => l.virtual).length,
      Math.round(r.layouts.reduce((a, l) => a + l.scrap_kg, 0)),
      r.layouts.length,
    ];
    const i = key.findIndex((v, j) => v !== bestKey[j]);
    if (!best || (i >= 0 && key[i] < bestKey[i])) {
      best = r;
      bestKey = key;
    }
  }
  return best!;
}

function nestOnce(parts: Part[], plates: Plate[], s: CutSettings, order: Order): Result {
  const byId = new Map(parts.map((p) => [p.id, p]));
  const groups = new Map<string, Unit[]>();
  for (const p of parts) {
    const [w, h] = partBox(p);
    if (!(w > 0 && h > 0)) continue;
    const k = groupKey(p.grade, p.thickness);
    const arr = groups.get(k) ?? [];
    for (let i = 0; i < p.qty; i++) arr.push({ part: p, w, h, area: w * h });
    groups.set(k, arr);
  }
  const layouts: Layout[] = [];
  const unplaced = new Map<string, number>();
  let vSerial = 0;

  for (const [k, all] of groups) {
    let units = [...all].sort(order);
    let pool = plates.filter((pl) => groupKey(pl.grade, pl.thickness) === k);
    const sample = all[0].part;
    while (units.length) {
      let best: { pl: Plate; r: ReturnType<typeof packPlate>; score: number; virtual: boolean } | null = null;
      const tryPlate = (pl: Plate, virtual: boolean) => {
        const r = packPlate(pl, units, s);
        if (!r.placed.length) return;
        const used = r.placed.reduce((a, p) => a + partArea(byId.get(p.part_id)!), 0);
        // البقايا تاخذ أفضلية بسيطة حتى تنستهلك قبل الألواح الكاملة
        const score = (used / (Number(pl.length_mm) * Number(pl.width_mm))) * (pl.parent_id ? 1.1 : 1);
        if (!best || score > best.score + EPS) best = { pl, r, score, virtual };
      };
      for (const pl of pool) tryPlate(pl, false);
      if (!best) {
        // ما بقى لوح بالمخزن يكفي: نجرب القياسات القياسية
        for (const [L, W] of s.sizes) {
          tryPlate(
            { id: `new-${k}-${L}x${W}-${vSerial}`, serial: 0, grade: sample.grade, thickness: Number(sample.thickness), length_mm: L, width_mm: W, density: 7.85, price_kg: 0, parent_id: null },
            true,
          );
        }
      }
      if (!best) {
        for (const u of units) unplaced.set(u.part.id, (unplaced.get(u.part.id) ?? 0) + 1);
        break;
      }
      const b = best as { pl: Plate; r: ReturnType<typeof packPlate>; score: number; virtual: boolean };
      if (b.virtual) vSerial++;
      layouts.push(summarize(b.pl, b.r.placed, pickRemnants(b.pl, b.r.free, s), byId, b.virtual));
      units = b.r.rest;
      pool = pool.filter((p) => p.id !== b.pl.id);
    }
  }
  return { layouts, unplaced: [...unplaced].map(([id, qty]) => ({ part: byId.get(id)!, qty })) };
}

// كم قطعة من كل نوع انقصت أو انحجزت بمخططات سابقة
export function countPlaced(layouts: { layout: unknown }[]) {
  const m = new Map<string, number>();
  for (const l of layouts) for (const p of (l.layout as Placed[]) ?? []) m.set(p.part_id, (m.get(p.part_id) ?? 0) + 1);
  return m;
}
