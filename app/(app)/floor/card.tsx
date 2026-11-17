import { STAGE_STATUS } from "@/lib/labels";
import { floorUpdate } from "../production/planning-actions";

export type FloorStage = { id: string; name: string; status: string; progress: number; plan_start: string | null; plan_end: string | null; center?: string | null; color?: string; order?: { id: string; no: number; product: string; client: string | null } | null };

// بطاقة مرحلة بأزرار كبيرة للتابلت
export function FloorCard({ s, back, today, canEdit }: { s: FloorStage; back: string; today: string; canEdit: boolean }) {
  const p = s.status === "done" ? 100 : s.progress;
  const late = s.status !== "done" && s.plan_end && s.plan_end < today;
  const Btn = ({ act, label, cls }: { act: string; label: string; cls?: string }) => (
    <form action={floorUpdate}>
      <input type="hidden" name="stage_id" value={s.id} />
      <input type="hidden" name="back" value={back} />
      <input type="hidden" name="act" value={act} />
      <button className={`btn ${cls ?? "ghost"}`} type="submit">{label}</button>
    </form>
  );
  return (
    <div className="floor-card" style={{ ["--c" as string]: s.color ?? "var(--muted)" }}>
      <div className="row between">
        {s.order ? <b className="num">#{s.order.no}</b> : null}
        <span className={`pill tone-${late ? "bad" : STAGE_STATUS[s.status]?.tone}`}>{late ? "متأخرة" : STAGE_STATUS[s.status]?.label}</span>
      </div>
      {s.order ? <div className="fc-product">{s.order.product}</div> : null}
      {s.order?.client ? <div className="meta">{s.order.client}</div> : null}
      <div className="fc-stage">{s.name}</div>
      {s.center ? <div className="meta">{s.center}</div> : null}
      {s.plan_start ? <div className="meta num">{s.plan_start} ← {s.plan_end}</div> : null}
      <div className="fc-prog"><div className="prog"><i style={{ width: `${p}%` }} /></div><b className="num">{p}%</b></div>
      {canEdit && (
        <div className="fc-btns">
          {s.status === "waiting" && <Btn act="start" label="▶ بدأت" cls="" />}
          {s.status === "working" && <Btn act="plus" label="+25%" />}
          {s.status !== "done" && <Btn act="done" label="✓ خلصت" cls={s.status === "waiting" ? "ghost" : ""} />}
          {s.status === "done" && <Btn act="undo" label="↺ تراجع" />}
        </div>
      )}
    </div>
  );
}
