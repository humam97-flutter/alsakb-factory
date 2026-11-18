import { AI_BETAS, AI_MODEL, ai, aiError, aiReady } from "@/lib/ai";
import { getMe } from "@/lib/auth";
import { SCAN_PROMPT, SCAN_SCHEMA, type ScanResult } from "@/lib/scan";
import { supabase } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 120;

const IMAGE = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
type ImageType = (typeof IMAGE)[number];
const json = (body: unknown, status = 200) => Response.json(body, { status });

export async function POST(req: Request) {
  const me = await getMe();
  if (me.role === "operator") return json({ error: "ليس لديك صلاحية." }, 403);
  if (!aiReady()) return json({ error: "مفتاح الذكاء الاصطناعي غير مضاف بعد. المدير يضيف ANTHROPIC_API_KEY بإعدادات Vercel." }, 503);
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || !file.size) return json({ error: "اختار صورة أو ملف PDF." }, 400);
  if (file.size > 4_000_000) return json({ error: "الملف أكبر من 4 ميگا. صوّره بدقة أقل أو قسّم الـ PDF." }, 400);
  const data = Buffer.from(await file.arrayBuffer()).toString("base64");
  const pdf = file.type === "application/pdf";
  if (!pdf && !IMAGE.includes(file.type as ImageType)) return json({ error: "الصيغة غير مدعومة. استعمل JPG أو PNG أو PDF." }, 400);

  try {
    const msg = await ai().beta.messages.create({
      model: AI_MODEL,
      max_tokens: 16000,
      betas: AI_BETAS,
      fallbacks: "default",
      output_config: { effort: "medium", format: { type: "json_schema", schema: SCAN_SCHEMA } },
      messages: [
        {
          role: "user",
          content: [
            pdf
              ? { type: "document", source: { type: "base64", media_type: "application/pdf", data } }
              : { type: "image", source: { type: "base64", media_type: file.type as ImageType, data } },
            { type: "text", text: SCAN_PROMPT },
          ],
        },
      ],
    });
    if (msg.stop_reason === "refusal") return json({ error: "ما كدرنا نقرأ هذا المستند." }, 422);
    const text = msg.content.find((b) => b.type === "text");
    if (!text || text.type !== "text") return json({ error: "ما وصلت نتيجة. جرّب صورة أوضح." }, 422);
    let result: ScanResult;
    try {
      result = JSON.parse(text.text);
    } catch {
      return json({ error: "النتيجة ناقصة. جرّب صورة أوضح أو صفحات أقل." }, 422);
    }
    const db = await supabase();
    await db.from("ai_log").insert({ kind: "scan", question: file.name.slice(0, 200), input_tokens: msg.usage.input_tokens, output_tokens: msg.usage.output_tokens, model: msg.model, created_by: me.id });
    return json({ result });
  } catch (e) {
    return json({ error: aiError(e) }, 502);
  }
}
