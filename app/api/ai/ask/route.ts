import type Anthropic from "@anthropic-ai/sdk";
import { AI_BETAS, AI_MODEL, ai, aiError, aiReady } from "@/lib/ai";
import { factorySnapshot } from "@/lib/ai-context";
import { getMe } from "@/lib/auth";
import { supabase } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 120;

const SYSTEM = `أنت مساعد "معمل السكب الحديدي" بالعراق: معمل يصنّع خزانات وأوعية ضغط وهياكل حديدية، ويقص الصاج بالليزر والبلازما ويلحم ويفحص.
تجاوب باللهجة العراقية البسيطة، بجمل قصيرة وواضحة، مثل زميل يعرف المعمل.
تعتمد فقط على "بيانات المعمل" المرفقة. إذا المعلومة مو موجودة بالبيانات، كول بصراحة "ما عندي هالمعلومة بالنظام" ولا تخمّن أرقام.
للحسابات الهندسية (أوزان، سماكات، ضغط) وضّح الافتراض والمعادلة باختصار، ونبّه إن القرار النهائي للمهندس.
الأرقام اكتبها بالأرقام الإنكليزية (123) مع الوحدة والعملة. إذا الجواب قائمة، خليها نقاط قصيرة. لا تستعمل جداول Markdown.
أنت تقرأ فقط: ما تقدر تعدّل أو تحذف أي شي بالنظام. إذا طلب المستخدم تعديل، دلّه على الصفحة المناسبة.`;

type Turn = { role: "user" | "assistant"; text: string };

export async function POST(req: Request) {
  const me = await getMe();
  if (!aiReady()) return new Response("مفتاح الذكاء الاصطناعي غير مضاف بعد. المدير يضيف ANTHROPIC_API_KEY بإعدادات Vercel.", { status: 503 });
  const db = await supabase();
  const { data: st } = await db.from("settings").select("ai_enabled, ai_monthly_limit").eq("id", 1).maybeSingle();
  if (st && st.ai_enabled === false) return new Response("المساعد موقوف من الإعدادات.", { status: 403 });
  const month = new Date().toISOString().slice(0, 7) + "-01";
  const { count } = await db.from("ai_log").select("id", { count: "exact", head: true }).gte("created_at", month);
  if (st?.ai_monthly_limit && (count ?? 0) >= st.ai_monthly_limit) return new Response("وصلنا حد الأسئلة لهذا الشهر. المدير يكدر يرفعه من الإعدادات.", { status: 429 });

  const body = (await req.json().catch(() => null)) as { turns?: Turn[] } | null;
  const turns = (body?.turns ?? []).filter((x) => x && (x.role === "user" || x.role === "assistant") && typeof x.text === "string" && x.text.trim()).slice(-20);
  if (!turns.length || turns[turns.length - 1].role !== "user") return new Response("اكتب سؤالك.", { status: 400 });
  const question = turns[turns.length - 1].text.slice(0, 4000);

  const snapshot = await factorySnapshot(db, me);
  const messages: Anthropic.Beta.BetaMessageParam[] = turns.map((x) => ({ role: x.role, content: x.text.slice(0, 8000) }));

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(ctrl) {
      try {
        const s = ai().beta.messages.stream({
          model: AI_MODEL,
          max_tokens: 16000,
          betas: AI_BETAS,
          fallbacks: "default",
          output_config: { effort: "medium" },
          cache_control: { type: "ephemeral" },
          system: [
            { type: "text", text: SYSTEM },
            { type: "text", text: `بيانات المعمل الحالية (JSON):\n${JSON.stringify(snapshot)}` },
          ],
          messages,
        });
        s.on("text", (d) => ctrl.enqueue(enc.encode(d)));
        const msg = await s.finalMessage();
        if (msg.stop_reason === "refusal") ctrl.enqueue(enc.encode("\n\nاعتذر، ما أكدر أجاوب على هالسؤال."));
        if (msg.stop_reason === "max_tokens") ctrl.enqueue(enc.encode("\n\n(الجواب انقطع لأنه طويل. اسأل بشكل أدق.)"));
        await db.from("ai_log").insert({ kind: "ask", question: question.slice(0, 500), input_tokens: msg.usage.input_tokens + (msg.usage.cache_read_input_tokens ?? 0) + (msg.usage.cache_creation_input_tokens ?? 0), output_tokens: msg.usage.output_tokens, model: msg.model, created_by: me.id });
      } catch (e) {
        ctrl.enqueue(enc.encode(`\n\n⚠ ${aiError(e)}`));
      }
      ctrl.close();
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
}
