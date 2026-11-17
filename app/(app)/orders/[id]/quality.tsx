import { Pill } from "@/components/ui";
import { can, type Role } from "@/lib/auth";
import { num, QC_ITEMS, QC_RESULT } from "@/lib/labels";
import { supabase } from "@/lib/supabase/server";
import { deleteQuality, deleteScrap, saveQuality, saveScrap } from "../../production/actions";

// فحص الجودة والهدر لأمر العمل
export async function OrderQuality({
  orderId,
  role,
  machines,
}: {
  orderId: string;
  role: Role;
  machines: { id: string; code: string; name: string }[];
}) {
  const db = await supabase();
  const [{ data: checks }, { data: scrap }] = await Promise.all([
    db.from("quality_checks").select("*").eq("order_id", orderId).order("created_at"),
    db.from("scrap").select("*, machine:machines(name)").eq("order_id", orderId).order("day"),
  ]);
  const qc = can.production(role);
  const sc = role !== "accountant";
  const back = `/orders/${orderId}`;
  const totalScrap = (scrap ?? []).reduce((a, s) => a + Number(s.kg), 0);

  return (
    <>
      <h3 className="sec">فحص الجودة</h3>
      <div className="panel">
        {checks?.length ? (
          <ul className="stages">
            {checks.map((c) => {
              const items = Object.entries(c.checks as Record<string, boolean>);
              const bad = items.filter(([, v]) => !v).map(([k]) => k);
              return (
                <li key={c.id}>
                  <span className="num meta">{c.day}</span>
                  <Pill map={QC_RESULT} value={c.result} />
                  <span className="name" style={{ fontSize: 13 }}>
                    {bad.length ? `ملاحظات على: ${bad.join("، ")}` : "كل البنود سليمة"}
                    {c.note && ` · ${c.note}`}
                    {c.inspector && <span className="meta"> · الفاحص: {c.inspector}</span>}
                  </span>
                  {qc && (
                    <form action={deleteQuality}>
                      <input type="hidden" name="id" value={c.id} />
                      <input type="hidden" name="order_id" value={orderId} />
                      <button className="btn ghost sm" type="submit" aria-label="حذف الفحص">×</button>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="meta" style={{ marginTop: 0 }}>ما انفحص بعد.</p>
        )}
        {qc && (
          <form action={saveQuality} style={{ marginTop: 10 }}>
            <input type="hidden" name="order_id" value={orderId} />
            <div className="checks">
              {QC_ITEMS.map((k, i) => (
                <label key={k}><input type="checkbox" name={`qc_${i}`} defaultChecked /> {k}</label>
              ))}
            </div>
            <div className="row" style={{ marginTop: 8 }}>
              <select name="result" defaultValue="pass" aria-label="النتيجة" style={{ width: 150 }}>
                {Object.entries(QC_RESULT).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
              <input name="inspector" placeholder="الفاحص" aria-label="الفاحص" style={{ width: 140 }} />
              <input name="note" placeholder="ملاحظة" aria-label="ملاحظة" style={{ flex: "1 1 160px", width: "auto" }} />
              <button className="btn ghost" type="submit">تسجيل الفحص</button>
            </div>
            <p className="meta" style={{ marginBottom: 0 }}>شيل الصح عن البند اللي بيه مشكلة. صور الشغل ترفعها من «الرسومات والصور».</p>
          </form>
        )}
      </div>

      <h3 className="sec">الهدر {totalScrap > 0 && <span className="meta">({num(totalScrap)} كغم)</span>}</h3>
      <div className="panel">
        {scrap?.length ? (
          <ul className="stages">
            {scrap.map((s) => (
              <li key={s.id}>
                <span className="num meta">{s.day}</span>
                <span className="name">{num(s.kg)} كغم{s.machine ? ` · ${(s.machine as { name: string }).name}` : ""}{s.reason ? ` · ${s.reason}` : ""}</span>
                {sc && (
                  <form action={deleteScrap}>
                    <input type="hidden" name="id" value={s.id} />
                    <input type="hidden" name="back" value={back} />
                    <button className="btn ghost sm" type="submit" aria-label="حذف">×</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        ) : null}
        {sc && (
          <form action={saveScrap} className="row" style={{ marginTop: scrap?.length ? 10 : 0 }}>
            <input type="hidden" name="order_id" value={orderId} />
            <input type="hidden" name="back" value={back} />
            <input name="kg" type="number" step="any" min="0" placeholder="الوزن كغم" aria-label="وزن الهدر" style={{ width: 110 }} required />
            <select name="machine_id" defaultValue="" aria-label="الماكنة" style={{ width: 170 }}>
              <option value="">الماكنة</option>
              {machines.map((m) => <option key={m.id} value={m.id}>{m.code}. {m.name}</option>)}
            </select>
            <input name="reason" placeholder="السبب: قص غلط، بقايا ما تنفع..." aria-label="السبب" style={{ flex: "1 1 160px", width: "auto" }} />
            <button className="btn ghost" type="submit">تسجيل هدر</button>
          </form>
        )}
      </div>
    </>
  );
}
