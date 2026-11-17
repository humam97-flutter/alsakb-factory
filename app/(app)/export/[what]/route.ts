import { NextResponse, type NextRequest } from "next/server";
import { DOC_KIND, DOC_STATUS, MOVE, ORDER_STATUS, PRIORITY, today } from "@/lib/labels";
import { supabase } from "@/lib/supabase/server";

// تصدير CSV يفتح بـ Excel (بالعربي، مع BOM). الصلاحيات من قاعدة البيانات نفسها
type Row = Record<string, unknown>;
type Sheet = { file: string; columns: [string, (r: Row) => unknown][]; rows: Row[] };

const lab = (m: Record<string, { label: string }>) => (v: unknown) => m[String(v)]?.label ?? v;

async function build(what: string, sp: URLSearchParams): Promise<Sheet | null> {
  const db = await supabase();
  switch (what) {
    case "orders": {
      const { data } = await db
        .from("work_orders")
        .select("no, product, client, client_phone, qty, unit, status, priority, start_date, due_date, owner:workers(full_name)")
        .order("no", { ascending: false });
      const st = lab(ORDER_STATUS), pr = lab(PRIORITY);
      return {
        file: "أوامر-العمل",
        rows: data ?? [],
        columns: [
          ["الرقم", (r) => r.no], ["المنتج", (r) => r.product], ["الزبون", (r) => r.client], ["الهاتف", (r) => r.client_phone],
          ["الكمية", (r) => r.qty], ["الوحدة", (r) => r.unit], ["الحالة", (r) => st(r.status)], ["الأولوية", (r) => pr(r.priority)],
          ["البدء", (r) => r.start_date], ["التسليم", (r) => r.due_date], ["المسؤول", (r) => (r.owner as Row | null)?.full_name],
        ],
      };
    }
    case "order-costs": {
      const { data } = await db.from("work_order_costs").select("*, order:work_orders(no, product, client)");
      return {
        file: "كلفة-الأوامر",
        rows: data ?? [],
        columns: [
          ["الرقم", (r) => (r.order as Row)?.no], ["المنتج", (r) => (r.order as Row)?.product], ["الزبون", (r) => (r.order as Row)?.client],
          ["المواد", (r) => r.cost_material], ["الأجور", (r) => r.cost_labor], ["التشغيل", (r) => r.cost_machine], ["أخرى", (r) => r.cost_other],
          ["مجموع الكلفة", (r) => r.cost_total], ["سعر البيع", (r) => r.price], ["المستلم", (r) => r.paid],
          ["الربح", (r) => (r.price == null ? "" : Number(r.price) - Number(r.cost_total))], ["العملة", (r) => r.currency],
        ],
      };
    }
    case "stock": {
      const { data } = await db.from("materials").select("*").order("name");
      return {
        file: "المخزن",
        rows: data ?? [],
        columns: [
          ["المادة", (r) => r.name], ["النوع", (r) => r.kind], ["الرتبة", (r) => r.grade], ["القياس", (r) => r.spec],
          ["الرصيد", (r) => r.qty], ["الوحدة", (r) => r.unit], ["حد الطلب", (r) => r.min_qty], ["سعر الوحدة", (r) => r.unit_price],
          ["القيمة", (r) => Number(r.qty) * Number(r.unit_price)], ["العملة", (r) => r.currency], ["المكان", (r) => r.location],
        ],
      };
    }
    case "moves": {
      let q = db
        .from("stock_moves")
        .select("day, kind, qty, unit_price, note, material:materials(name, unit), order:work_orders(no)")
        .order("day", { ascending: false });
      if (sp.get("from")) q = q.gte("day", sp.get("from")!);
      if (sp.get("to")) q = q.lte("day", sp.get("to")!);
      const { data } = await q.limit(20000);
      const mv = lab(MOVE);
      return {
        file: "حركات-المخزن",
        rows: data ?? [],
        columns: [
          ["التاريخ", (r) => r.day], ["الحركة", (r) => mv(r.kind)], ["المادة", (r) => (r.material as Row)?.name],
          ["الكمية", (r) => r.qty], ["الوحدة", (r) => (r.material as Row)?.unit], ["سعر الوحدة", (r) => r.unit_price],
          ["القيمة", (r) => Number(r.qty) * Number(r.unit_price)], ["أمر العمل", (r) => (r.order as Row | null)?.no], ["ملاحظة", (r) => r.note],
        ],
      };
    }
    case "payroll": {
      const month = sp.get("month") ?? today().slice(0, 7);
      const { data } = await db.from("monthly_payroll").select("*").eq("month", `${month}-01`).order("full_name");
      return {
        file: `الرواتب-${month}`,
        rows: data ?? [],
        columns: [
          ["العامل", (r) => r.full_name], ["أيام الحضور", (r) => r.days], ["ساعات إضافية", (r) => r.overtime_hours],
          ["الأجر اليومي", (r) => r.daily_wage], ["المستحق", (r) => r.earned], ["مكافآت", (r) => r.bonus], ["خصومات", (r) => r.deduction],
          ["سلف", (r) => r.advance], ["المدفوع", (r) => r.paid], ["الباقي", (r) => r.balance], ["العملة", (r) => r.currency],
        ],
      };
    }
    case "workers": {
      const { data } = await db.from("workers").select("full_name, job, phone, active").order("full_name");
      return {
        file: "العمال",
        rows: data ?? [],
        columns: [["الاسم", (r) => r.full_name], ["العمل", (r) => r.job], ["الهاتف", (r) => r.phone], ["فعّال", (r) => (r.active ? "نعم" : "لا")]],
      };
    }
    case "documents": {
      const { data } = await db.from("documents").select("*").order("doc_date", { ascending: false });
      const k = lab(DOC_KIND), s = lab(DOC_STATUS);
      return {
        file: "المستندات",
        rows: data ?? [],
        columns: [
          ["الرقم", (r) => r.ref_no], ["التاريخ", (r) => r.doc_date], ["النوع", (r) => k(r.kind)], ["الموضوع", (r) => r.subject],
          ["الجهة", (r) => r.party], ["الحالة", (r) => s(r.status)], ["موعد الرد", (r) => r.due_date], ["ينتهي", (r) => r.expires_on],
          ["المبلغ", (r) => r.amount], ["العملة", (r) => r.currency],
        ],
      };
    }
  }
  return null;
}

const cell = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export async function GET(request: NextRequest, { params }: { params: Promise<{ what: string }> }) {
  const { what } = await params;
  const sheet = await build(what, request.nextUrl.searchParams);
  if (!sheet) return new NextResponse("غير موجود", { status: 404 });
  const lines = [sheet.columns.map(([h]) => cell(h)).join(","), ...sheet.rows.map((r) => sheet.columns.map(([, f]) => cell(f(r))).join(","))];
  const name = `${sheet.file}-${today()}.csv`;
  return new NextResponse("﻿" + lines.join("\r\n"), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="export.csv"; filename*=UTF-8''${encodeURIComponent(name)}`,
      "cache-control": "no-store",
    },
  });
}
