import Anthropic from "@anthropic-ai/sdk";

// الذكاء الاصطناعي: Claude من Anthropic. المفتاح بمتغيرات Vercel فقط (ANTHROPIC_API_KEY)، ما ينحفظ بالكود ولا بقاعدة البيانات
export const AI_MODEL = "claude-opus-5-5";
// إذا رفض النموذج طلباً بسبب مصنّفات الأمان، الخادم يعيده تلقائياً على نموذج بديل
export const AI_BETAS = ["server-side-fallback-2026-07-01"];

export const aiReady = () => Boolean(process.env.ANTHROPIC_API_KEY);

let client: Anthropic | null = null;
export function ai() {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("مفتاح الذكاء الاصطناعي غير مضاف. أضف ANTHROPIC_API_KEY بإعدادات Vercel.");
  client ??= new Anthropic();
  return client;
}

// رسالة خطأ مفهومة للمستخدم
export function aiError(e: unknown): string {
  if (e instanceof Anthropic.AuthenticationError) return "مفتاح الذكاء الاصطناعي غير صحيح. راجع ANTHROPIC_API_KEY بإعدادات Vercel.";
  if (e instanceof Anthropic.RateLimitError) return "الطلبات كثيرة هسه. انتظر دقيقة وجرّب مرة ثانية.";
  if (e instanceof Anthropic.BadRequestError) return "الطلب ما انقبل (ممكن الملف كبير أو صيغته غير مدعومة).";
  if (e instanceof Anthropic.APIConnectionError) return "ما كدرنا نتصل بخدمة الذكاء الاصطناعي. تأكد من الإنترنت.";
  if (e instanceof Anthropic.APIError) return `خدمة الذكاء الاصطناعي رجعت خطأ (${e.status}). جرّب بعد شوية.`;
  return e instanceof Error ? e.message : "صار خطأ غير متوقع.";
}
