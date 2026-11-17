import Link from "next/link";
import { addDays, diffDays, isOff } from "@/lib/planning";

export type GanttBar = { key: string; start: string; end: string; color: string; label: string; progress: number; done: boolean };
export type GanttRow = { key: string; label: React.ReactNode; sub?: React.ReactNode; href?: string; due?: string | null; bars: GanttBar[] };

const AR_MONTH = ["كانون الثاني", "شباط", "آذار", "نيسان", "أيار", "حزيران", "تموز", "آب", "أيلول", "تشرين الأول", "تشرين الثاني", "كانون الأول"];

// مخطط زمني: الأيام تمشي من اليمين لليسار، الأشرطة بلون مركز العمل والجزء الغامق هو المنجز
export function Gantt({ from, days, rows, today, off }: { from: string; days: number; rows: GanttRow[]; today: string; off: number[] }) {
  const to = addDays(from, days - 1);
  const pos = (d: string) => (Math.max(0, Math.min(days, diffDays(from, d))) / days) * 100;
  const width = (a: string, b: string) => Math.max(0.6, pos(addDays(b, 1)) - pos(a));
  const ticks: string[] = [];
  const offs: string[] = [];
  for (let i = 0; i < days; i++) {
    const d = addDays(from, i);
    if (isOff(d, off)) offs.push(d);
    if (i === 0 || d.endsWith("-01") || (days <= 70 && new Date(d + "T00:00:00Z").getUTCDay() === 6)) ticks.push(d);
  }
  const showToday = today >= from && today <= to;
  const Grid = () => (
    <>
      {offs.map((d) => <span key={d} className="g-off" style={{ insetInlineStart: `${pos(d)}%`, width: `${100 / days}%` }} />)}
      {showToday && <span className="g-today" style={{ insetInlineStart: `${pos(today)}%` }} />}
    </>
  );
  return (
    <div className="gantt">
      <div className="g-row g-head">
        <div className="g-label" />
        <div className="g-track">
          {ticks.map((d) => (
            <span key={d} className="g-tick" style={{ insetInlineStart: `${pos(d)}%` }}>
              {d.endsWith("-01") || d === from ? <b>{AR_MONTH[Number(d.slice(5, 7)) - 1]}</b> : null}
              <span className="num">{Number(d.slice(8))}</span>
            </span>
          ))}
        </div>
      </div>
      {rows.map((r) => (
        <div key={r.key} className="g-row">
          <div className="g-label">
            {r.href ? <Link href={r.href}>{r.label}</Link> : r.label}
            {r.sub ? <div className="meta">{r.sub}</div> : null}
          </div>
          <div className="g-track">
            <Grid />
            {r.bars.filter((b) => b.end >= from && b.start <= to).map((b) => (
              <span
                key={b.key}
                className={`g-bar${b.done ? " done" : ""}`}
                title={`${b.label}: ${b.start} ← ${b.end} · ${b.progress}%`}
                style={{ insetInlineStart: `${pos(b.start)}%`, width: `${width(b.start, b.end)}%`, ["--c" as string]: b.color }}
              >
                <i style={{ width: `${b.done ? 100 : b.progress}%` }} />
              </span>
            ))}
            {r.due && r.due >= from && r.due <= to && <span className="g-due" title={`موعد التسليم ${r.due}`} style={{ insetInlineStart: `${pos(addDays(r.due, 1))}%` }} />}
          </div>
        </div>
      ))}
    </div>
  );
}
