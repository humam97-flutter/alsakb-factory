import { money } from "@/lib/labels";

// رسوم بسيطة بـ SVG بدون مكتبات. القيم بالدينار
const short = (v: number) => {
  const a = Math.abs(v);
  if (a >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (a >= 1e6) return `${(v / 1e6).toFixed(v % 1e6 ? 1 : 0)}M`;
  if (a >= 1e3) return `${Math.round(v / 1e3)}K`;
  return Math.round(v).toLocaleString("en-US");
};

export type Series = { name: string; color: string; values: number[] };

// أعمدة متجاورة لكل شهر (مثلاً المبيعات مقابل الكلف)
export function GroupedBars({ labels, series, height = 220, unit }: { labels: string[]; series: Series[]; height?: number; unit?: string }) {
  const W = 640, H = height, pad = { t: 14, b: 28, s: 70 };
  const max = Math.max(1, ...series.flatMap((s) => s.values));
  const ticks = [0, 0.5, 1].map((f) => f * max);
  const y = (v: number) => pad.t + (1 - v / max) * (H - pad.t - pad.b);
  const gw = (W - pad.s - 8) / Math.max(1, labels.length);
  const bw = Math.min(22, (gw * 0.7) / series.length);
  return (
    <figure style={{ margin: 0 }}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={series.map((s) => s.name).join(" و ")} style={{ width: "100%", height: "auto", display: "block" }}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={8} x2={W - pad.s} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeDasharray={t ? "3 4" : undefined} />
            <text x={W - 2} y={y(t) + 4} fontSize={11} textAnchor="end" direction="ltr" fill="var(--muted)">{short(t)}</text>
          </g>
        ))}
        {labels.map((l, i) => {
          // من اليمين لليسار
          const gx = W - pad.s - (i + 1) * gw + (gw - bw * series.length - 2 * (series.length - 1)) / 2;
          return (
            <g key={l}>
              {series.map((s, k) => {
                const v = s.values[i] ?? 0;
                const top = y(Math.max(0, v));
                return (
                  <rect key={s.name} x={gx + k * (bw + 2)} y={top} width={bw} height={Math.max(v > 0 ? 2 : 0, y(0) - top)} rx={4} fill={s.color}>
                    <title>{`${l} · ${s.name}: ${unit ? `${Math.round(v).toLocaleString("en-US")} ${unit}` : money(v)}`}</title>
                  </rect>
                );
              })}
              <text x={gx + (bw * series.length) / 2} y={H - 8} textAnchor="middle" fontSize={11.5} fill="var(--muted)">{l}</text>
            </g>
          );
        })}
      </svg>
      <figcaption className="legend">
        {series.map((s) => (
          <span key={s.name}><i style={{ background: s.color }} />{s.name}</span>
        ))}
      </figcaption>
    </figure>
  );
}

// شريط مقسم بالنسب (مثلاً حالة الأوامر)
export function StackBar({ parts }: { parts: { label: string; value: number; color: string }[] }) {
  const total = parts.reduce((a, p) => a + p.value, 0);
  return (
    <div>
      <div className="stack" role="img" aria-label={parts.map((p) => `${p.label} ${p.value}`).join("، ")}>
        {total === 0 ? <span style={{ flex: 1, background: "var(--chip)" }} /> : parts.filter((p) => p.value).map((p) => (
          <span key={p.label} style={{ flex: p.value, background: p.color }} title={`${p.label}: ${p.value}`} />
        ))}
      </div>
      <div className="legend">
        {parts.map((p) => (
          <span key={p.label}><i style={{ background: p.color }} />{p.label} <b className="num">{p.value}</b></span>
        ))}
      </div>
    </div>
  );
}
