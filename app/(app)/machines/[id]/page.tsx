import { notFound } from "next/navigation";
import { Alert, Pill, type IdPageProps } from "@/components/ui";
import { can, requireRole } from "@/lib/auth";
import { MAINT_KIND, MAINT_STATE, money } from "@/lib/labels";
import { supabase } from "@/lib/supabase/server";
import { MachineForm } from "../machine-form";

export default async function EditMachinePage({ params, searchParams }: IdPageProps) {
  await requireRole(can.production);
  const { id } = await params;
  const { error } = await searchParams;
  const db = await supabase();
  const [{ data: m }, { data: workers }, { data: history }] = await Promise.all([
    db.from("machines").select("*").eq("id", id).maybeSingle(),
    db.from("workers").select("id, full_name").eq("active", true).order("full_name"),
    db.from("maintenance").select("*").eq("machine_id", id).order("day", { ascending: false }).limit(30),
  ]);
  if (!m) notFound();
  return (
    <>
      <div className="bar"><h2>{m.code}. {m.name}</h2></div>
      <Alert error={error} />
      <MachineForm m={m} workers={workers ?? []} />
      <h3 className="sec">سجل الصيانة</h3>
      {history?.length ? (
        <div className="tbl">
          <table>
            <thead><tr><th>التاريخ</th><th>النوع</th><th>الحالة</th><th>الوصف</th><th className="n">الكلفة</th></tr></thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id}>
                  <td className="num">{h.day}</td>
                  <td><Pill map={MAINT_KIND} value={h.kind} /></td>
                  <td><Pill map={MAINT_STATE} value={h.state} /></td>
                  <td style={{ whiteSpace: "normal" }}>{h.description}</td>
                  <td className="n num">{money(h.cost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty">لا توجد صيانة مسجلة لهذه الماكنة.</div>
      )}
    </>
  );
}
