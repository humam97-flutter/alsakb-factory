import { dailyReport } from "@/lib/daily-report";
import { siteUrl } from "@/lib/site";
import { supabaseAdmin } from "@/lib/supabase/server";
import { sendTelegram } from "@/lib/telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Vercel Cron يناديه كل صباح (vercel.json) ويرسل الـ CRON_SECRET بالهيدر
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return new Response("unauthorized", { status: 401 });
  const db = supabaseAdmin() as never as Parameters<typeof dailyReport>[0];
  const { data: st } = await db.from("settings").select("telegram_chat_id, report_enabled").eq("id", 1).maybeSingle();
  if (!st?.report_enabled || !st.telegram_chat_id) return Response.json({ sent: false, reason: "disabled" });
  const text = await dailyReport(db, siteUrl());
  const err = await sendTelegram(st.telegram_chat_id, text);
  return Response.json({ sent: !err, error: err });
}
