import { PrintButton } from "@/components/print-button";
import { can, requireRole } from "@/lib/auth";
import { qrSvg, siteUrl } from "@/lib/qr";
import { supabase } from "@/lib/supabase/server";

// بطاقات العمال للطباعة: المشرف يصوّر البطاقة بموبايله ويسجل الدخول والخروج
export default async function CardsPage() {
  await requireRole(can.production);
  const db = await supabase();
  const [{ data: workers }, { data: s }] = await Promise.all([
    db.from("workers").select("id, full_name, job").eq("active", true).order("full_name"),
    db.from("settings").select("factory_name").eq("id", 1).maybeSingle(),
  ]);
  const cards = await Promise.all((workers ?? []).map(async (w) => ({ ...w, qr: await qrSvg(await siteUrl(`/workers/scan/${w.id}`)) })));
  return (
    <div style={{ background: "#fff", color: "#000", padding: 16, borderRadius: 8 }}>
      <div className="noprint actions" style={{ marginTop: 0, marginBottom: 12 }}>
        <PrintButton />
        <span className="meta">اطبعها وقصّها. كل عامل بطاقته، والمشرف يصورها عند الدخول والخروج.</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
        {cards.map((w) => (
          <div key={w.id} style={{ border: "1px solid #000", borderRadius: 8, padding: 10, textAlign: "center", breakInside: "avoid" }}>
            <div style={{ fontSize: 12 }}>{s?.factory_name ?? "معمل السكب الحديدي"}</div>
            <div style={{ width: 140, height: 140, margin: "8px auto" }} dangerouslySetInnerHTML={{ __html: w.qr }} />
            <b style={{ fontSize: 16 }}>{w.full_name}</b>
            {w.job && <div style={{ fontSize: 12 }}>{w.job}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
