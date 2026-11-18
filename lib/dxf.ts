import { placeGeom, type Geom, type Pt } from "@/lib/dxf-import";
import type { Placed, Rect } from "@/lib/nesting";

// ملف DXF (R12) لمخطط القص: يفتح ببرامج الـ CNC (ليزر وبلازما) و AutoCAD و LibreCAD
// الوحدة ملم، ونقطة الأصل زاوية اللوح السفلى اليسرى. الطبقات: PLATE حدود اللوح، PARTS القطع، HOLES الفتحات، REMNANTS البقايا، LABELS الرموز
export function planDxf(L: number, W: number, placed: Placed[], remnants: Rect[], opts: { title: string; withRemnants?: boolean; geoms?: Record<string, Geom | null | undefined> } = { title: "" }) {
  const out: string[] = [];
  const g = (code: number, v: string | number) => out.push(String(code), typeof v === "number" ? fmt(v) : v);
  const fmt = (n: number) => (Math.round(n * 1000) / 1000).toString();
  const Y = (y: number) => W - y; // الرسم بالشاشة من فوق لجوه، والـ DXF من جوه لفوق

  const keys = partKeys(placed);

  g(999, `${opts.title}`.replace(/[^\x20-\x7e]/g, "").trim() || "cut plan");
  g(0, "SECTION"); g(2, "HEADER");
  g(9, "$ACADVER"); g(1, "AC1009");
  g(9, "$EXTMIN"); g(10, 0); g(20, 0); g(30, 0);
  g(9, "$EXTMAX"); g(10, L); g(20, W); g(30, 0);
  g(0, "ENDSEC");

  const layers: [string, number][] = [["PLATE", 7], ["PARTS", 1], ["HOLES", 5], ["REMNANTS", 3], ["LABELS", 8]];
  g(0, "SECTION"); g(2, "TABLES");
  g(0, "TABLE"); g(2, "LAYER"); g(70, layers.length);
  for (const [name, color] of layers) { g(0, "LAYER"); g(2, name); g(70, 0); g(62, color); g(6, "CONTINUOUS"); }
  g(0, "ENDTAB");
  g(0, "ENDSEC");

  g(0, "SECTION"); g(2, "ENTITIES");
  const line = (layer: string, x1: number, y1: number, x2: number, y2: number) => { g(0, "LINE"); g(8, layer); g(10, x1); g(20, y1); g(30, 0); g(11, x2); g(21, y2); g(31, 0); };
  const rect = (layer: string, x: number, y: number, w: number, h: number) => {
    const a = Y(y), b = Y(y + h);
    line(layer, x, a, x + w, a); line(layer, x + w, a, x + w, b); line(layer, x + w, b, x, b); line(layer, x, b, x, a);
  };
  const circle = (layer: string, cx: number, cy: number, r: number) => { g(0, "CIRCLE"); g(8, layer); g(10, cx); g(20, Y(cy)); g(30, 0); g(40, r); };
  const text = (x: number, y: number, h: number, s: string) => { g(0, "TEXT"); g(8, "LABELS"); g(10, x); g(20, Y(y)); g(30, 0); g(40, h); g(1, s); g(72, 1); g(11, x); g(21, Y(y)); g(31, 0); };

  const polyline = (layer: string, pts: Pt[]) => {
    g(0, "POLYLINE"); g(8, layer); g(66, 1); g(10, 0); g(20, 0); g(30, 0); g(70, 1);
    for (const [x, y] of pts) { g(0, "VERTEX"); g(8, layer); g(10, x); g(20, Y(y)); g(30, 0); }
    g(0, "SEQEND"); g(8, layer);
  };

  rect("PLATE", 0, 0, L, W);
  for (const p of placed) {
    const geo = opts.geoms?.[p.part_id];
    if (geo) {
      const pg = placeGeom(geo, p.rot ? p.h : p.w, p.rot, p.x, p.y);
      if (pg.circle) circle("PARTS", p.x + p.w / 2, p.y + p.h / 2, pg.circle);
      else polyline("PARTS", pg.outer);
      for (const h of pg.holes) h.kind === "circle" ? circle("HOLES", h.cx, h.cy, h.r) : polyline("HOLES", h.pts);
    } else if (p.shape === "rect") rect("PARTS", p.x, p.y, p.w, p.h);
    else {
      circle("PARTS", p.x + p.w / 2, p.y + p.h / 2, p.w / 2);
      if (p.inner) circle("HOLES", p.x + p.w / 2, p.y + p.h / 2, p.inner / 2);
    }
    const h = Math.max(5, Math.min(40, Math.min(p.w, p.h) / 5));
    text(p.x + p.w / 2, p.y + p.h / 2 + (p.inner ? p.inner / 2 + h : 0), h, keys.get(p.part_id)!);
  }
  if (opts.withRemnants) for (const r of remnants) rect("REMNANTS", r.x, r.y, r.w, r.h);
  g(0, "ENDSEC");
  g(0, "EOF");
  return { dxf: out.join("\r\n") + "\r\n", keys };
}

// رمز كل قطعة بالترتيب (P1، P2...) نفس اللي بالملف، حتى يطابق جدول القطع المطبوع
export function partKeys(placed: Placed[]) {
  const keys = new Map<string, string>();
  for (const p of placed) if (!keys.has(p.part_id)) keys.set(p.part_id, `P${keys.size + 1}`);
  return keys;
}
