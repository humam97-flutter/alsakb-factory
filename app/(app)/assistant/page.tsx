import { aiReady } from "@/lib/ai";
import { can, getMe } from "@/lib/auth";
import { Chat } from "./chat";

export default async function AssistantPage() {
  const me = await getMe();
  const fin = can.finance(me.role);
  const ideas = [
    "شنو أهم 5 أشياء لازم انتبه إلها اليوم؟",
    "أي أوامر عمل متأخرة أو راح تتأخر؟ وشنو السبب؟",
    "شنو المواد اللي قربت تخلص ولازم نطلبها؟",
    "عندي ألواح A36 سمك 10 كافية لأوامر هالأسبوع؟",
    ...(fin ? ["منو الزبائن اللي عليهم أكثر ديون؟", "قارن أرباح آخر 3 أشهر وكلي شنو تغيّر", "شلون وضع المشاريع والدفعات المستحقة؟"] : []),
  ];
  return (
    <>
      <div className="bar"><h2>المساعد الذكي</h2></div>
      {!aiReady() && (
        <div className="alert">المساعد يحتاج مفتاح الذكاء الاصطناعي. المدير يضيف <bdi className="ltr">ANTHROPIC_API_KEY</bdi> بإعدادات Vercel، وبعدها يشتغل مباشرة.</div>
      )}
      <Chat ideas={ideas} disabled={!aiReady()} />
      <p className="meta">المساعد يقرأ بيانات المعمل بصلاحياتك أنت (اللي تشوفه بالنظام بس)، وما يعدّل أي شي. تأكد من الأرقام المهمة قبل ما تعتمدها.</p>
    </>
  );
}
