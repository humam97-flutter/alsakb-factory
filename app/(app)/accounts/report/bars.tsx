// رسم أعمدة بسيط لقيمة وحدة عبر الأشهر، موجبة وسالبة حول الصفر
export function Bars({ data, label }: { data: { x: string; y: number }[]; label: string }) {
  const W = 640, H = 200, pad = { t: 12, b: 26, s: 8 };
  const max = Math.max(1, ...data.map((d) => d.y));
  const min = Math.min(0, ...data.map((d) => d.y));
  const span = max - min;
  const y = (v: number) => pad.t + ((max - v) / span) * (H - pad.t - pad.b);
  const bw = (W - pad.s * 2) / Math.max(1, data.length);
  const fmt = (v: number) => (Math.abs(v) >= 1e6 ? `${(v / 1e6).toFixed(1)} مليون` : Math.round(v).toLocaleString("en-US"));
  return (
    <figure style={{ margin: 0 }}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} style={{ width: "100%", height: "auto", display: "block" }}>
        <line x1={pad.s} x2={W - pad.s} y1={y(0)} y2={y(0)} stroke="var(--line)" strokeWidth={1} />
        {data.map((d, i) => {
          const x = W - pad.s - (i + 1) * bw + bw * 0.2; // من اليمين لليسار
          const top = Math.min(y(d.y), y(0));
          const h = Math.max(1, Math.abs(y(d.y) - y(0)));
          return (
            <g key={d.x}>
              <rect x={x} y={top} width={bw * 0.6} height={h} rx={3} fill={d.y < 0 ? "var(--bad)" : "var(--info)"}>
                <title>{`${d.x}: ${fmt(d.y)}`}</title>
              </rect>
              <text x={x + bw * 0.3} y={H - 8} textAnchor="middle" fontSize={11} fill="var(--muted)">{d.x.slice(5)}</text>
            </g>
          );
        })}
      </svg>
      <figcaption className="meta">{label}. مرّر على العمود لتشوف الرقم. الأحمر خسارة.</figcaption>
    </figure>
  );
}
