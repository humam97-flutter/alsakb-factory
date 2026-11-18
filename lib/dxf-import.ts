// قراءة مخطط تصميم DXF وتطليع القطع منه: كل حدود مغلقة خارجية = قطعة، واللي جواها = فتحات
// يدعم: LINE، ARC، CIRCLE، LWPOLYLINE (مع الأقواس)، POLYLINE، ELLIPSE، SPLINE (تقريبي)، والبلوكات (INSERT)
// يشتغل بالمتصفح، فالملف ما يحتاج يترفع للسيرفر

export type Pt = [number, number];
export type Hole = { kind: "circle"; cx: number; cy: number; r: number } | { kind: "poly"; pts: Pt[] };
// الشكل بإحداثيات محلية: الأصل زاوية المستطيل المحيط، وy لجوه (مثل الشاشة)
export type Geom = { outer: Pt[]; holes: Hole[]; circle?: number };

type Loop = { id: number; pts: Pt[]; circle?: { cx: number; cy: number; r: number }; layer: string; area: number; per: number; box: [number, number, number, number] };
type Path = { pts: Pt[]; layer: string };

export type ImportedPart = {
  key: string; // P1، P2...
  name: string;
  layer: string;
  shape: "rect" | "circle" | "ring" | "poly";
  w: number; // عرض المستطيل المحيط (ملم)
  h: number;
  diameter?: number;
  inner?: number;
  area: number; // المساحة الصافية بعد الفتحات (ملم²)
  cutLen: number; // طول القص: المحيط + الفتحات (ملم)
  pierces: number; // عدد مرات الثقب (بداية كل قص)
  holes: number;
  qty: number; // العدد بالرسم
  thickness: number | null; // إذا مكتوب باسم الطبقة
  geom: Geom;
  loopIds: number[];
};

export type DxfModel = { loops: Loop[]; open: number; units: string; scale: number; entities: number; layers: string[] };

const UNITS: Record<number, [string, number]> = { 0: ["بدون وحدة (نفترض ملم)", 1], 1: ["إنج", 25.4], 2: ["قدم", 304.8], 4: ["ملم", 1], 5: ["سم", 10], 6: ["متر", 1000] };
// طبقات نتجاهلها: أبعاد، نصوص، إطار ولوحة عنوان، خطوط مخفية ومحاور
const SKIP_LAYER = /dim|text|txt|anno|note|border|frame|title|tblock|hidden|hid|center|centre|axis|cl$|^defpoints$|بعد|نص|اطار|إطار/i;

const TOL = 0.05; // سماحية ربط نهايات الخطوط (ملم)
const ARC_STEP = Math.PI / 36; // كل 5 درجات نقطة

function arcPts(cx: number, cy: number, r: number, a0: number, a1: number): Pt[] {
  let sweep = a1 - a0;
  while (sweep <= 0) sweep += Math.PI * 2;
  const n = Math.max(2, Math.ceil(sweep / ARC_STEP));
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = a0 + (sweep * i) / n;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as Pt;
  });
}

// قوس بين نقطتين من الـ bulge (ظل ربع زاوية القوس)
function bulgePts(p: Pt, q: Pt, b: number): Pt[] {
  if (Math.abs(b) < 1e-9) return [q];
  const th = 4 * Math.atan(b);
  const dx = q[0] - p[0], dy = q[1] - p[1];
  const c = Math.hypot(dx, dy);
  if (c < 1e-9) return [q];
  const r = c / (2 * Math.sin(Math.abs(th) / 2));
  const mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2;
  const d = Math.sqrt(Math.max(0, r * r - (c / 2) ** 2));
  const s = (b > 0 ? 1 : -1) * (Math.abs(th) > Math.PI ? -1 : 1);
  const cx = mx - (s * d * dy) / c, cy = my + (s * d * dx) / c;
  const a0 = Math.atan2(p[1] - cy, p[0] - cx);
  const n = Math.max(2, Math.ceil(Math.abs(th) / ARC_STEP));
  const out: Pt[] = [];
  for (let i = 1; i <= n; i++) {
    const a = a0 + (th * i) / n;
    out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  out[out.length - 1] = q;
  return out;
}

const signedArea = (pts: Pt[]) => {
  let s = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) s += (pts[j][0] + pts[i][0]) * (pts[j][1] - pts[i][1]);
  return s / 2;
};
const perimeter = (pts: Pt[], closed = true) => {
  let s = 0;
  for (let i = 1; i < pts.length; i++) s += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  if (closed && pts.length > 1) s += Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]);
  return s;
};
const bbox = (pts: Pt[]): [number, number, number, number] => {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) {
    if (x < x0) x0 = x;
    if (y < y0) y0 = y;
    if (x > x1) x1 = x;
    if (y > y1) y1 = y;
  }
  return [x0, y0, x1, y1];
};
function inside(p: Pt, poly: Pt[]) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
const near = (a: Pt, b: Pt, t = TOL) => Math.abs(a[0] - b[0]) <= t && Math.abs(a[1] - b[1]) <= t;

// ---------- قراءة الملف ----------
type Ent = { type: string; g: [number, string][] };
type Xf = { tx: number; ty: number; sx: number; sy: number; rot: number; bx: number; by: number };

function pairs(text: string): [number, string][] {
  const lines = text.split(/\r?\n/);
  const out: [number, string][] = [];
  for (let i = 0; i + 1 < lines.length; i += 2) {
    const c = parseInt(lines[i].trim(), 10);
    if (Number.isNaN(c)) {
      i--; // سطر زايد: نرجع خطوة حتى نرجع للتزامن
      continue;
    }
    out.push([c, lines[i + 1].trim()]);
  }
  return out;
}

export function parseDxf(text: string, unitOverride?: number): DxfModel {
  if (/^AutoCAD Binary DXF/.test(text.slice(0, 22))) throw new Error("الملف DXF ثنائي (Binary). احفظه من البرنامج كـ DXF عادي (ASCII).");
  if (text.slice(0, 6) === "AC1015" || /^AC10\d\d/.test(text.slice(0, 6))) throw new Error("هذا ملف DWG. من AutoCAD سوّي Save As واختار DXF، وارفع الملف الجديد.");
  const P = pairs(text);
  if (!P.some(([c, v]) => c === 0 && v === "SECTION")) throw new Error("الملف مو DXF أو تالف.");
  let insunits = 4;
  const blocks = new Map<string, { bx: number; by: number; ents: Ent[] }>();
  const top: Ent[] = [];
  let section = "";
  let cur: Ent | null = null;
  let block: { name: string; bx: number; by: number; ents: Ent[] } | null = null;
  const flush = () => {
    if (!cur) return;
    if (section === "BLOCKS" && block && cur.type !== "BLOCK" && cur.type !== "ENDBLK") block.ents.push(cur);
    else if (section === "ENTITIES") top.push(cur);
    cur = null;
  };
  for (let i = 0; i < P.length; i++) {
    const [c, v] = P[i];
    if (c === 0) {
      flush();
      if (v === "SECTION") {
        section = P[i + 1]?.[0] === 2 ? P[i + 1][1] : "";
        continue;
      }
      if (v === "ENDSEC") {
        section = "";
        continue;
      }
      if (section === "BLOCKS" && v === "BLOCK") {
        let name = "", bx = 0, by = 0;
        for (let j = i + 1; j < P.length && P[j][0] !== 0; j++) {
          if (P[j][0] === 2) name = P[j][1];
          if (P[j][0] === 10) bx = +P[j][1];
          if (P[j][0] === 20) by = +P[j][1];
        }
        block = { name, bx, by, ents: [] };
        blocks.set(name, block);
        cur = { type: "BLOCK", g: [] };
        continue;
      }
      if (section === "BLOCKS" && v === "ENDBLK") {
        block = null;
        cur = { type: "ENDBLK", g: [] };
        continue;
      }
      cur = { type: v, g: [] };
      continue;
    }
    if (section === "HEADER" && c === 9 && v === "$INSUNITS") {
      const nx = P[i + 1];
      if (nx && nx[0] === 70) insunits = parseInt(nx[1], 10);
    }
    if (cur) cur.g.push([c, v]);
  }
  flush();

  const unitCode = unitOverride ?? insunits;
  const [units, scale] = UNITS[unitCode] ?? UNITS[0];
  const loops: Loop[] = [];
  const paths: Path[] = [];
  const layers = new Set<string>();
  let count = 0;

  const apply = (x: Xf, p: Pt): Pt => {
    const lx = (p[0] - x.bx) * x.sx, ly = (p[1] - x.by) * x.sy;
    const c = Math.cos(x.rot), s = Math.sin(x.rot);
    return [x.tx + lx * c - ly * s, x.ty + lx * s + ly * c];
  };

  const addLoop = (pts: Pt[], layer: string, circle?: { cx: number; cy: number; r: number }) => {
    if (pts.length < 3) return;
    const s = pts.map((p) => [p[0] * scale, p[1] * scale] as Pt);
    if (near(s[0], s[s.length - 1])) s.pop();
    const area = Math.abs(signedArea(s));
    if (area < 1) return; // نقاط أو خطوط مكررة
    loops.push({ id: loops.length, pts: s, layer, area, per: circle ? 2 * Math.PI * circle.r * scale : perimeter(s), box: bbox(s), ...(circle ? { circle: { cx: circle.cx * scale, cy: circle.cy * scale, r: circle.r * scale } } : {}) });
  };
  const addPath = (pts: Pt[], layer: string) => {
    if (pts.length < 2) return;
    paths.push({ pts: pts.map((p) => [p[0] * scale, p[1] * scale] as Pt), layer });
  };

  const walk = (ents: Ent[], T: (p: Pt) => Pt, uniform: number, depth: number, parentLayer?: string) => {
    if (depth > 8) return;
    for (let k = 0; k < ents.length; k++) {
      const e = ents[k];
      const get = (c: number) => e.g.find(([x]) => x === c)?.[1];
      const num = (c: number, d = 0) => {
        const v = get(c);
        return v === undefined ? d : parseFloat(v);
      };
      let layer = get(8) ?? "0";
      if (layer === "0" && parentLayer) layer = parentLayer;
      if (get(67) === "1") continue; // مساحة الورق
      if (e.type === "INSERT") {
        const b = blocks.get(get(2) ?? "");
        if (!b) continue;
        const cols = Math.max(1, num(70, 1)), rows = Math.max(1, num(71, 1));
        const dc = num(44), dr = num(45);
        for (let ci = 0; ci < cols; ci++)
          for (let ri = 0; ri < rows; ri++) {
            const x: Xf = { tx: num(10) + ci * dc, ty: num(20) + ri * dr, sx: num(41, 1), sy: num(42, 1), rot: (num(50) * Math.PI) / 180, bx: b.bx, by: b.by };
            walk(b.ents, (p: Pt) => T(apply(x, p)), uniform * Math.abs(x.sx), depth + 1, layer);
          }
        continue;
      }
      if (SKIP_LAYER.test(layer)) continue;
      if (!["LINE", "ARC", "CIRCLE", "LWPOLYLINE", "POLYLINE", "ELLIPSE", "SPLINE"].includes(e.type)) continue;
      count++;
      layers.add(layer);
      if (e.type === "LINE") addPath([T([num(10), num(20)]), T([num(11), num(21)])], layer);
      else if (e.type === "CIRCLE") {
        const c = T([num(10), num(20)]), r = num(40) * uniform;
        addLoop(arcPts(c[0], c[1], r, 0, Math.PI * 2).slice(0, -1), layer, { cx: c[0], cy: c[1], r });
      } else if (e.type === "ARC") {
        const pts = arcPts(num(10), num(20), num(40), (num(50) * Math.PI) / 180, (num(51) * Math.PI) / 180).map(T);
        addPath(pts, layer);
      } else if (e.type === "LWPOLYLINE") {
        const closed = (num(70) & 1) === 1;
        const vs: { p: Pt; b: number }[] = [];
        for (const [c, v] of e.g) {
          if (c === 10) vs.push({ p: [parseFloat(v), 0], b: 0 });
          else if (c === 20 && vs.length) vs[vs.length - 1].p[1] = parseFloat(v);
          else if (c === 42 && vs.length) vs[vs.length - 1].b = parseFloat(v);
        }
        poly(vs, closed, layer);
      } else if (e.type === "POLYLINE") {
        const closed = (num(70) & 1) === 1;
        const vs: { p: Pt; b: number }[] = [];
        for (k++; k < ents.length && ents[k].type === "VERTEX"; k++) {
          const g = ents[k].g;
          const f = (c: number) => parseFloat(g.find(([x]) => x === c)?.[1] ?? "0");
          vs.push({ p: [f(10), f(20)], b: f(42) });
        }
        poly(vs, closed, layer);
      } else if (e.type === "ELLIPSE") {
        const cx = num(10), cy = num(20), mx = num(11), my = num(21), ratio = num(40, 1);
        let t0 = num(41), t1 = num(42, Math.PI * 2);
        const a = Math.hypot(mx, my), rot = Math.atan2(my, mx);
        while (t1 <= t0) t1 += Math.PI * 2;
        const n = Math.max(8, Math.ceil((t1 - t0) / ARC_STEP));
        const pts: Pt[] = Array.from({ length: n + 1 }, (_, i) => {
          const t = t0 + ((t1 - t0) * i) / n;
          const x = a * Math.cos(t), y = a * ratio * Math.sin(t);
          return T([cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)]);
        });
        if (t1 - t0 >= Math.PI * 2 - 1e-6) addLoop(pts.slice(0, -1), layer);
        else addPath(pts, layer);
      } else if (e.type === "SPLINE") {
        const fit: Pt[] = [], ctl: Pt[] = [];
        for (const [c, v] of e.g) {
          if (c === 11) fit.push([parseFloat(v), 0]);
          else if (c === 21 && fit.length) fit[fit.length - 1][1] = parseFloat(v);
          else if (c === 10) ctl.push([parseFloat(v), 0]);
          else if (c === 20 && ctl.length) ctl[ctl.length - 1][1] = parseFloat(v);
        }
        const pts = (fit.length >= 2 ? fit : ctl).map(T);
        if ((num(70) & 1) === 1 || (pts.length > 2 && near(pts[0], pts[pts.length - 1], TOL / scale))) addLoop(pts, layer);
        else addPath(pts, layer);
      }
    }
    function poly(vs: { p: Pt; b: number }[], closed: boolean, layer: string) {
      if (vs.length < 2) return;
      const pts: Pt[] = [vs[0].p];
      for (let i = 1; i < vs.length; i++) pts.push(...bulgePts(vs[i - 1].p, vs[i].p, vs[i - 1].b));
      if (closed) pts.push(...bulgePts(vs[vs.length - 1].p, vs[0].p, vs[vs.length - 1].b));
      const tp = pts.map(T);
      if (closed || near(tp[0], tp[tp.length - 1], TOL / scale)) addLoop(tp, layer);
      else addPath(tp, layer);
    }
  };
  walk(top, (p) => p, 1, 0);

  // ربط الخطوط والأقواس المفتوحة لحدود مغلقة
  const left = paths.slice();
  let open = 0;
  while (left.length) {
    const first = left.shift()!;
    const chain = first.pts.slice();
    let grew = true;
    while (grew && !near(chain[0], chain[chain.length - 1], TOL * 4)) {
      grew = false;
      const end = chain[chain.length - 1];
      for (let i = 0; i < left.length; i++) {
        const p = left[i].pts;
        if (near(p[0], end, TOL * 4)) chain.push(...p.slice(1));
        else if (near(p[p.length - 1], end, TOL * 4)) chain.push(...p.slice(0, -1).reverse());
        else continue;
        left.splice(i, 1);
        grew = true;
        break;
      }
    }
    if (chain.length > 3 && near(chain[0], chain[chain.length - 1], TOL * 4)) {
      chain.pop();
      const area = Math.abs(signedArea(chain));
      if (area >= 1) loops.push({ id: loops.length, pts: chain, layer: first.layer, area, per: perimeter(chain), box: bbox(chain) });
    } else open++;
  }
  return { loops, open, units, scale, entities: count, layers: [...layers] };
}

// ---------- القطع ----------
// الحلقة A تحتوي B؟
const contains = (a: Loop, b: Loop) =>
  a.area > b.area && a.box[0] <= b.box[0] + TOL && a.box[1] <= b.box[1] + TOL && a.box[2] >= b.box[2] - TOL && a.box[3] >= b.box[3] - TOL && inside(b.pts[0], a.pts) && inside(b.pts[Math.floor(b.pts.length / 2)], a.pts);

const thicknessOf = (layer: string) => {
  const m = layer.match(/(?:^|[^a-z])(?:t|thk|pl|th)[\s_-]*(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?)\s*(?:mm|ملم)/i);
  const v = m ? parseFloat(m[1] ?? m[2]) : NaN;
  return v > 0 && v <= 200 ? v : null;
};

// إطار الرسم: مستطيل يحتوي قطع كاملة بداخله (مو فتحات)
export function guessFrames(m: DxfModel): number[] {
  const out: number[] = [];
  for (const a of m.loops) {
    const kids = m.loops.filter((b) => b !== a && contains(a, b));
    const direct = kids.filter((b) => !kids.some((c) => c !== b && contains(c, b)));
    const withHoles = direct.filter((b) => kids.some((c) => c !== b && contains(b, c)));
    const rectish = a.pts.length <= 6 && Math.abs(a.area - (a.box[2] - a.box[0]) * (a.box[3] - a.box[1])) < a.area * 0.01;
    if (withHoles.length >= 2 || (rectish && direct.filter((b) => !b.circle).length >= 3)) out.push(a.id);
  }
  return out;
}

export function extractParts(m: DxfModel, ignore: Set<number>): ImportedPart[] {
  const ls = m.loops.filter((l) => !ignore.has(l.id));
  // العمق: عدد الحدود اللي تحتويها. الزوجي = قطعة، الفردي = فتحة بالقطعة اللي فوكها
  const parent = new Map<number, Loop | null>();
  const depth = new Map<number, number>();
  for (const b of ls) {
    const holders = ls.filter((a) => a !== b && contains(a, b));
    depth.set(b.id, holders.length);
    parent.set(b.id, holders.sort((x, y) => x.area - y.area)[0] ?? null);
  }
  const raw: ImportedPart[] = [];
  for (const o of ls.filter((l) => depth.get(l.id)! % 2 === 0)) {
    const hs = ls.filter((l) => parent.get(l.id)?.id === o.id && depth.get(l.id)! % 2 === 1);
    const [x0, y0, x1, y1] = o.box;
    const w = x1 - x0, h = y1 - y0;
    // إحداثيات محلية: y لجوه مثل الشاشة
    const loc = (p: Pt): Pt => [Math.round((p[0] - x0) * 100) / 100, Math.round((y1 - p[1]) * 100) / 100];
    const geom: Geom = {
      outer: o.pts.map(loc),
      holes: hs.map((hl) => (hl.circle ? { kind: "circle" as const, cx: loc([hl.circle.cx, hl.circle.cy])[0], cy: loc([hl.circle.cx, hl.circle.cy])[1], r: hl.circle.r } : { kind: "poly" as const, pts: hl.pts.map(loc) })),
      ...(o.circle ? { circle: o.circle.r } : {}),
    };
    const area = o.area - hs.reduce((a, x) => a + x.area, 0);
    const rect = !o.circle && o.pts.length === 4 && Math.abs(o.area - w * h) < 0.5;
    const ring = o.circle && hs.length === 1 && hs[0].circle && Math.hypot(hs[0].circle.cx - o.circle.cx, hs[0].circle.cy - o.circle.cy) < 0.5;
    const shape: ImportedPart["shape"] = o.circle && !hs.length ? "circle" : ring ? "ring" : rect && !hs.length ? "rect" : "poly";
    raw.push({
      key: "",
      name: "",
      layer: o.layer,
      shape,
      w: Math.round(w * 10) / 10,
      h: Math.round(h * 10) / 10,
      ...(o.circle ? { diameter: Math.round(o.circle.r * 20) / 10 } : {}),
      ...(ring ? { inner: Math.round(hs[0].circle!.r * 20) / 10 } : {}),
      area,
      cutLen: o.per + hs.reduce((a, x) => a + x.per, 0),
      pierces: 1 + hs.length,
      holes: hs.length,
      qty: 1,
      thickness: thicknessOf(o.layer),
      geom,
      loopIds: [o.id, ...hs.map((x) => x.id)],
    });
  }
  // القطع المتشابهة (نفس المساحة والمحيط والقياس، حتى لو مدوّرة) تنجمع بسطر واحد
  const groups = new Map<string, ImportedPart>();
  for (const p of raw) {
    const k = [Math.round(p.area / 10), Math.round(p.cutLen), Math.round(Math.max(p.w, p.h)), Math.round(Math.min(p.w, p.h)), p.holes, p.thickness ?? ""].join("|");
    const g = groups.get(k);
    if (g) {
      g.qty++;
      g.loopIds.push(...p.loopIds);
    } else groups.set(k, p);
  }
  const parts = [...groups.values()].sort((a, b) => b.area - a.area);
  const LABEL: Record<string, string> = { rect: "لوح مستطيل", circle: "قرص", ring: "حلقة", poly: "قطعة" };
  parts.forEach((p, i) => {
    p.key = `P${i + 1}`;
    p.name = `${LABEL[p.shape]} ${p.key}`;
  });
  return parts;
}

// تدوير الشكل 90 درجة بنفس طريقة الترتيب على اللوح: (x, y) ← (y, w - x)
export function placeGeom(g: Geom, w: number, rot: boolean, dx: number, dy: number): Geom {
  const t = (p: Pt): Pt => (rot ? [dx + p[1], dy + (w - p[0])] : [dx + p[0], dy + p[1]]);
  return {
    outer: g.outer.map(t),
    holes: g.holes.map((h) => (h.kind === "circle" ? { ...h, cx: t([h.cx, h.cy])[0], cy: t([h.cx, h.cy])[1] } : { kind: "poly", pts: h.pts.map(t) })),
    circle: g.circle,
  };
}

export const svgPath = (pts: Pt[]) => (pts.length ? `M${pts.map((p) => `${Math.round(p[0] * 10) / 10},${Math.round(p[1] * 10) / 10}`).join("L")}Z` : "");
