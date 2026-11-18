// إرسال رسالة لتيليكرام. التوكن بمتغيرات Vercel فقط (TELEGRAM_BOT_TOKEN)
export const telegramReady = () => Boolean(process.env.TELEGRAM_BOT_TOKEN);

export async function sendTelegram(chatId: string, text: string): Promise<string | null> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return "توكن بوت تيليكرام غير مضاف. أضف TELEGRAM_BOT_TOKEN بإعدادات Vercel.";
  // تيليكرام يقبل لحد 4096 حرف بالرسالة
  const chunks = text.match(/[\s\S]{1,3900}(\n|$)/g) ?? [text];
  for (const c of chunks) {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: c, disable_web_page_preview: true }),
    }).catch(() => null);
    if (!res) return "ما كدرنا نتصل بتيليكرام.";
    if (!res.ok) {
      const j = (await res.json().catch(() => null)) as { description?: string } | null;
      return `تيليكرام رفض الرسالة: ${j?.description ?? res.status}. تأكد من رقم المحادثة وإن البوت مضاف للمجموعة.`;
    }
  }
  return null;
}
