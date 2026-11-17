import { NextResponse } from "next/server";
import { getMe } from "@/lib/auth";
import { today } from "@/lib/labels";
import { supabase } from "@/lib/supabase/server";

// نسخة كاملة من بيانات المعمل بملف JSON واحد، للمدير فقط
const TABLES = [
  "settings", "profiles", "machines", "workers", "worker_wages", "attendance", "worker_payments",
  "materials", "work_orders", "work_order_finance", "work_order_stages", "stock_moves", "maintenance", "maintenance_plans",
  "quality_checks", "scrap", "offcuts", "order_files", "documents", "document_files",
  "customers", "quotes", "quote_lines", "invoices", "invoice_lines", "customer_payments",
  "suppliers", "purchase_requests", "purchase_invoices", "purchase_lines", "supplier_payments",
  "expenses", "cash_entries", "audit_log",
] as const;

export const maxDuration = 60;

export async function GET() {
  const me = await getMe();
  if (me.role !== "manager") return new NextResponse("للمدير فقط", { status: 403 });
  const db = await supabase();
  const out: Record<string, unknown> = { created_at: new Date().toISOString(), by: me.full_name };
  for (const t of TABLES) {
    const rows: unknown[] = [];
    // Supabase يرجع 1000 صف بالمرة كحد أقصى، فنجيبها على دفعات
    for (let from = 0; ; from += 1000) {
      const { data, error } = await db.from(t).select("*").range(from, from + 999);
      if (error) { out[t] = { error: error.message }; break; }
      rows.push(...(data ?? []));
      if (!data || data.length < 1000) { out[t] = rows; break; }
    }
  }
  return new NextResponse(JSON.stringify(out), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="alsakb-backup-${today()}.json"`,
    },
  });
}
