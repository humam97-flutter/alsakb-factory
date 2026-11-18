import { can, requireRole } from "@/lib/auth";
import { num } from "@/lib/labels";
import { supabase } from "@/lib/supabase/server";

// السعر التقريبي لـ Claude Opus 5.5: 4 دولار لكل مليون token داخل، و 20 للطالع
const COST = (i: number, o: number) => (i * 4 + o * 20) / 1_000_000;
const KIND: Record<string, string> = { ask: "سؤال للمساعد", scan: "قراءة مستند", report: "تقرير" };

export default async function UsagePage() {
  await requireRole(can.users);
  const db = await supabase();
  const since = new Date(Date.now() - 180 * 864e5).toISOString();
  const { data } = await db.from("ai_log").select("kind, question, input_tokens, output_tokens, created_at, created_by").gte("created_at", since).order("created_at", { ascending: false }).limit(2000);
  const rows = data ?? [];
  const ids = [...new Set(rows.slice(0, 50).map((r) => r.created_by).filter(Boolean))];
  const { data: people } = ids.length ? await db.from("profiles").select("id, full_name").in("id", ids) : { data: [] };
  const who = new Map((people ?? []).map((p) => [p.id, p.full_name]));
  const months = new Map<string, { n: number; scan: number; i: number; o: number }>();
  for (const r of rows) {
    const m = String(r.created_at).slice(0, 7);
    const e = months.get(m) ?? { n: 0, scan: 0, i: 0, o: 0 };
    if (r.kind === "scan") e.scan++;
    else e.n++;
    e.i += Number(r.input_tokens);
    e.o += Number(r.output_tokens);
    months.set(m, e);
  }
  const cur = months.get(new Date().toISOString().slice(0, 7));
  return (
    <>
      <div className="bar"><h2>استخدام الذكاء الاصطناعي</h2></div>
      <div className="kpis">
        <div className="kpi"><span>أسئلة هذا الشهر</span><b className="num">{num(cur?.n ?? 0)}</b></div>
        <div className="kpi"><span>مستندات انقرت</span><b className="num">{num(cur?.scan ?? 0)}</b></div>
        <div className="kpi"><span>الكلفة التقريبية هذا الشهر</span><b className="num">{`$${(cur ? COST(cur.i, cur.o) : 0).toFixed(2)}`}</b><span className="meta">الفاتورة الفعلية من حساب Anthropic</span></div>
      </div>
      <div className="tbl" style={{ marginBottom: 14 }}>
        <table data-plain>
          <thead><tr><th>الشهر</th><th className="n">أسئلة</th><th className="n">مستندات</th><th className="n">tokens داخلة</th><th className="n">tokens طالعة</th><th className="n">الكلفة $</th></tr></thead>
          <tbody>
            {[...months].map(([m, e]) => (
              <tr key={m}><td className="num">{m}</td><td className="n num">{num(e.n)}</td><td className="n num">{num(e.scan)}</td><td className="n num">{num(e.i)}</td><td className="n num">{num(e.o)}</td><td className="n num">{COST(e.i, e.o).toFixed(2)}</td></tr>
            ))}
            {!months.size && <tr><td colSpan={6} className="meta">ماكو استخدام لحد الآن.</td></tr>}
          </tbody>
        </table>
      </div>
      <h3 className="sec">آخر الطلبات</h3>
      <div className="tbl">
        <table data-plain>
          <thead><tr><th>الوقت</th><th>المستخدم</th><th>النوع</th><th>السؤال أو الملف</th></tr></thead>
          <tbody>
            {rows.slice(0, 50).map((r, i) => (
              <tr key={i}>
                <td className="num">{new Date(r.created_at).toLocaleString("en-GB", { timeZone: "Asia/Baghdad", dateStyle: "short", timeStyle: "short" })}</td>
                <td>{who.get(r.created_by) ?? ""}</td>
                <td>{KIND[r.kind] ?? r.kind}</td>
                <td style={{ whiteSpace: "normal", maxWidth: 480 }}>{r.question}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={4} className="meta">ماكو طلبات.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
