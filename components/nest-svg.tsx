import { placeGeom, svgPath, type Geom } from "@/lib/dxf-import";
import type { Placed, Rect } from "@/lib/nesting";

// رسم اللوح: القطع، البقايا (مخططة بالأخضر)، والهدر (لون اللوح)
export function NestSvg({ L, W, placed, remnants, edge = 0, max = 900, geoms }: { L: number; W: number; placed: Placed[]; remnants: Rect[]; edge?: number; max?: number; geoms?: Record<string, Geom | null | undefined> }) {
  const fs = Math.max(L, W) / 55;
  const ids = [...new Set(placed.map((p) => p.part_id))];
  const tone = (id: string) => `var(--nest-${ids.indexOf(id) % 6})`;
  return (
    <svg className="nest" viewBox={`${-fs * 0.2} ${-fs * 1.6} ${L + fs * 0.4} ${W + fs * 1.8}`} style={{ maxWidth: max }} role="img" aria-label={`لوح ${L}×${W} عليه ${placed.length} قطعة`}>
      <defs>
        <pattern id="rem" width={fs * 0.8} height={fs * 0.8} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2={fs * 0.8} stroke="var(--ok)" strokeWidth={fs * 0.12} />
        </pattern>
      </defs>
      <rect x={0} y={0} width={L} height={W} className="nest-plate" />
      {edge > 0 && <rect x={edge} y={edge} width={L - 2 * edge} height={W - 2 * edge} className="nest-edge" />}
      {remnants.map((r, i) => (
        <g key={`r${i}`}>
          <rect x={r.x} y={r.y} width={r.w} height={r.h} fill="url(#rem)" className="nest-rem" />
          <text x={r.x + r.w / 2} y={r.y + r.h / 2} className="nest-t rem" fontSize={fs * 0.9} textAnchor="middle" dominantBaseline="middle">
            بقية {Math.round(Math.max(r.w, r.h))}×{Math.round(Math.min(r.w, r.h))}
          </text>
        </g>
      ))}
      {placed.map((p, i) => {
        const big = Math.min(p.w, p.h) > fs * 1.6;
        return (
          <g key={i} style={{ ["--c" as string]: tone(p.part_id) }}>
            <title>{`${p.name}: ${Math.round(p.w)}×${Math.round(p.h)}${p.rot ? " (مدوّرة)" : ""}`}</title>
            {geoms?.[p.part_id] ? (
              <GeomShape g={placeGeom(geoms[p.part_id]!, p.rot ? p.h : p.w, p.rot, p.x, p.y)} />
            ) : p.shape === "rect" ? (
              <rect x={p.x} y={p.y} width={p.w} height={p.h} className="nest-part" />
            ) : (
              <>
                <circle cx={p.x + p.w / 2} cy={p.y + p.h / 2} r={p.w / 2} className="nest-part" />
                {p.inner ? <circle cx={p.x + p.w / 2} cy={p.y + p.h / 2} r={p.inner / 2} className="nest-hole" /> : null}
              </>
            )}
            {big && (
              <text x={p.x + p.w / 2} y={p.y + p.h / 2} className="nest-t" fontSize={Math.min(fs, p.h / 3, p.w / Math.max(4, p.name.length * 0.6))} textAnchor="middle" dominantBaseline="middle">
                {p.name}
              </text>
            )}
          </g>
        );
      })}
      <text x={L / 2} y={-fs * 0.5} className="nest-dim" fontSize={fs} textAnchor="middle">{L} ملم</text>
    </svg>
  );
}

// قطعة بشكل حر من المخطط: الحدود والفتحات
export function GeomShape({ g }: { g: Geom }) {
  return (
    <>
      <path d={svgPath(g.outer)} className="nest-part" />
      {g.holes.map((h, i) => (h.kind === "circle" ? <circle key={i} cx={h.cx} cy={h.cy} r={h.r} className="nest-hole" /> : <path key={i} d={svgPath(h.pts)} className="nest-hole" />))}
    </>
  );
}

export function YieldBar({ parts, remnant, scrap }: { parts: number; remnant: number; scrap: number }) {
  const t = parts + remnant + scrap || 1;
  const pc = (v: number) => `${((v / t) * 100).toFixed(1)}%`;
  return (
    <div className="ybar" aria-label={`قطع ${pc(parts)}، بقايا ${pc(remnant)}، هدر ${pc(scrap)}`}>
      <span className="y-parts" style={{ width: pc(parts) }} />
      <span className="y-rem" style={{ width: pc(remnant) }} />
      <span className="y-scrap" style={{ width: pc(scrap) }} />
    </div>
  );
}
