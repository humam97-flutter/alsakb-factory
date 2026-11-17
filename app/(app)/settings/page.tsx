import { Alert, Input, TextArea, type PageProps } from "@/components/ui";
import { can, requireRole } from "@/lib/auth";
import { supabase } from "@/lib/supabase/server";
import { saveSettings } from "../sales/actions";

export default async function SettingsPage({ searchParams }: PageProps) {
  await requireRole(can.users);
  const { error, ok } = await searchParams;
  const db = await supabase();
  const { data: s } = await db.from("settings").select("*").eq("id", 1).maybeSingle();
  return (
    <>
      <div className="bar"><h2>إعدادات المعمل</h2></div>
      <Alert error={error} ok={ok} />
      <form action={saveSettings} className="panel">
        <div className="fields">
          <Input name="factory_name" label="اسم المعمل (يطلع بالفواتير)" value={s?.factory_name} full />
          <Input name="address" label="العنوان" value={s?.address} full />
          <Input name="phone" label="هواتف المعمل" value={s?.phone} />
          <Input name="usd_rate" label="سعر صرف الدولار (دينار)" value={s?.usd_rate} type="number" />
          <Input name="shift_hours" label="ساعات الدوام اليومي (اللي يزيد إضافي)" value={s?.shift_hours} type="number" />
          <TextArea name="invoice_footer" label="ملاحظة أسفل الفاتورة وعرض السعر" value={s?.invoice_footer} />
        </div>
        <div className="actions"><button className="btn" type="submit">حفظ</button></div>
      </form>
    </>
  );
}
