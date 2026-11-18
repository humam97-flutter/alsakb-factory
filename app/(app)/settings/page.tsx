import { Alert, Input, TextArea, type PageProps } from "@/components/ui";
import { can, requireRole } from "@/lib/auth";
import { supabase } from "@/lib/supabase/server";
import { Mark } from "@/components/letterhead";
import { Upload } from "@/components/upload";
import { logoUrl } from "@/lib/brand";
import { removeLogo, saveLogo, saveSettings } from "../sales/actions";
import { saveAiSettings, sendTestReport } from "../assistant/actions";
import { aiReady } from "@/lib/ai";
import { dailyReport } from "@/lib/daily-report";
import { siteUrl } from "@/lib/site";
import { telegramReady } from "@/lib/telegram";
import { waLink } from "@/lib/share";

export default async function SettingsPage({ searchParams }: PageProps) {
  await requireRole(can.users);
  const { error, ok } = await searchParams;
  const db = await supabase();
  const { data: s } = await db.from("settings").select("*").eq("id", 1).maybeSingle();
  const report = await dailyReport(db, siteUrl());
  return (
    <>
      <div className="bar"><h2>إعدادات المعمل</h2></div>
      <Alert error={error} ok={ok} />
      <div className="panel" style={{ marginBottom: 14 }}>
        <div className="panel-h"><b>شعار المعمل</b></div>
        <div className="row" style={{ gap: 16 }}>
          <Mark logo={logoUrl(s?.logo_path)} size={72} />
          <div style={{ flex: 1, minWidth: 200 }}>
            <p className="meta" style={{ margin: "0 0 8px" }}>يطلع بالقائمة وبكل المطبوعات (الفواتير، عروض الأسعار، أوامر العمل، كشوف الرواتب). صورة PNG أو JPG مربعة، أقل من 2 ميغا.</p>
            <div className="row">
              <Upload bucket="branding" folder="logo" save={saveLogo} single label={s?.logo_path ? "تغيير الشعار" : "+ رفع الشعار"} accept="image/png,image/jpeg,image/webp,image/svg+xml" />
              {s?.logo_path && (
                <form action={removeLogo}><button className="btn danger sm" type="submit" data-confirm="تشيل الشعار؟">شيل الشعار</button></form>
              )}
            </div>
          </div>
        </div>
      </div>
      <form action={saveSettings} className="panel">
        <div className="fields">
          <Input name="factory_name" label="اسم المعمل (يطلع بالفواتير)" value={s?.factory_name} full />
          <Input name="address" label="العنوان" value={s?.address} full />
          <Input name="phone" label="هواتف المعمل" value={s?.phone} />
          <Input name="email" label="البريد الإلكتروني" value={s?.email} type="email" />
          <Input name="reg_no" label="رقم التسجيل أو الإجازة" value={s?.reg_no} />
          <Input name="manager_name" label="اسم المدير (يطلع تحت التوقيع)" value={s?.manager_name} />
          <Input name="usd_rate" label="سعر صرف الدولار (دينار)" value={s?.usd_rate} type="number" />
          <Input name="shift_hours" label="ساعات الدوام اليومي (اللي يزيد إضافي)" value={s?.shift_hours} type="number" />
          <TextArea name="invoice_footer" label="ملاحظة أسفل الفاتورة وعرض السعر" value={s?.invoice_footer} />
        </div>
        <div className="actions"><button className="btn" type="submit">حفظ</button></div>
      </form>
      <h3 className="sec" id="ai">الذكاء الاصطناعي والتقرير اليومي</h3>
      <form action={saveAiSettings} className="panel">
        <div className="kv" style={{ marginBottom: 14 }}>
          <div><span className="meta">مفتاح الذكاء الاصطناعي</span><b className={aiReady() ? "pos" : "neg"}>{aiReady() ? "مضاف ✓" : "غير مضاف"}</b></div>
          <div><span className="meta">بوت تيليكرام</span><b className={telegramReady() ? "pos" : "neg"}>{telegramReady() ? "مضاف ✓" : "غير مضاف"}</b></div>
        </div>
        <div className="fields">
          <label className="row" style={{ flexDirection: "row", alignItems: "center", gap: 8, color: "var(--ink)" }}><input type="checkbox" name="ai_enabled" defaultChecked={s?.ai_enabled ?? true} /> تشغيل المساعد وقراءة المستندات</label>
          <Input name="ai_monthly_limit" label="حد الطلبات بالشهر (للتحكم بالكلفة)" value={s?.ai_monthly_limit ?? 2000} type="number" />
          <Input name="telegram_chat_id" label="رقم محادثة أو مجموعة تيليكرام" value={s?.telegram_chat_id} />
          <label className="row" style={{ flexDirection: "row", alignItems: "center", gap: 8, color: "var(--ink)" }}><input type="checkbox" name="report_enabled" defaultChecked={s?.report_enabled ?? false} /> إرسال تقرير كل يوم الساعة 7 الصبح</label>
        </div>
        <p className="meta">المفاتيح (ANTHROPIC_API_KEY و TELEGRAM_BOT_TOKEN و CRON_SECRET) تنضاف بإعدادات Vercel فقط، ما تنكتب هنا.</p>
        <div className="actions">
          <button className="btn" type="submit">حفظ</button>
          <button className="btn ghost" type="submit" formAction={sendTestReport} disabled={!telegramReady() || !s?.telegram_chat_id}>أرسل تقرير تجربة لتيليكرام</button>
          <a className="btn ghost" href={waLink(null, report)} target="_blank" rel="noreferrer">أرسل التقرير بواتساب</a>
        </div>
      </form>
      <h3 className="sec">النسخ الاحتياطي</h3>
      <div className="panel">
        <p style={{ marginTop: 0 }}>نسخة يومية تلقائية لقاعدة البيانات تنحفظ بـ GitHub لمدة 90 يوم (تفاصيل التفعيل بملف README).</p>
        <a className="btn ghost" href="/export/backup">تنزيل نسخة كاملة الآن (JSON)</a>
      </div>
    </>
  );
}
