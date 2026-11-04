import Link from "next/link";
import { Alert, Pill, type PageProps } from "@/components/ui";
import { can, getMe } from "@/lib/auth";
import { MACHINE_STATUS, today } from "@/lib/labels";
import { supabase } from "@/lib/supabase/server";

export default async function MachinesPage({ searchParams }: PageProps) {
  const { error } = await searchParams;
  const me = await getMe();
  const db = await supabase();
  const [{ data: machines }, { data: active }] = await Promise.all([
    db.from("machines").select("*, operator:workers(full_name)"),
    db.from("work_orders").select("machines").eq("status", "in_progress"),
  ]);
  const busy = new Map<string, number>();
  (active ?? []).forEach((o) => (o.machines as string[]).forEach((m) => busy.set(m, (busy.get(m) ?? 0) + 1)));
  const list = (machines ?? []).sort((a, b) => Number(a.code) - Number(b.code));
  const t = today();
  return (
    <>
      <Alert error={error} />
      <div className="bar">
        <h2>المكائن</h2>
        <Link className="btn ghost" href="/maintenance/new">بلّغ عن عطل</Link>
        {can.production(me.role) && <Link className="btn" href="/machines/new">+ ماكنة</Link>}
      </div>
      <div className="grid">
        {list.map((m) => {
          const due = m.next_service && m.next_service <= t;
          const body = (
            <>
              <div className="row between">
                <span className="t">
                  {m.code}. {m.name}
                </span>
                <Pill map={MACHINE_STATUS} value={m.status} />
              </div>
              <div className="meta">
                {m.capacity && <span>{m.capacity}</span>}
                {m.operator && <span>المشغل: {(m.operator as { full_name: string }).full_name}</span>}
                {m.next_service && (
                  <span>
                    الصيانة: <span className="num">{m.next_service}</span> {due && <b className="tone-warn">مستحقة</b>}
                  </span>
                )}
                {busy.get(m.id) && <span>عليها {busy.get(m.id)} أمر قيد التنفيذ</span>}
              </div>
            </>
          );
          const cls = `card s-${MACHINE_STATUS[m.status].tone}`;
          return can.production(me.role) ? (
            <Link key={m.id} href={`/machines/${m.id}`} className={cls}>{body}</Link>
          ) : (
            <div key={m.id} className={cls}>{body}</div>
          );
        })}
      </div>
    </>
  );
}
