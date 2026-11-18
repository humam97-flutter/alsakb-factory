"use client";

import { useState } from "react";
import type { ScanItem, ScanResult } from "@/lib/scan";
import { saveScan } from "../actions";

// الصورة الكبيرة نصغّرها بالمتصفح قبل الإرسال (أسرع وأرخص، وتبقى مقروءة)
async function shrink(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/") || file.size < 1_200_000) return file;
  const img = await createImageBitmap(file);
  const k = Math.min(1, 2000 / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * k);
  c.height = Math.round(img.height * k);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  return await new Promise((res) => c.toBlob((b) => res(b ?? file), "image/jpeg", 0.85));
}

const COLS: { k: keyof ScanItem; label: string; num?: boolean; w?: number }[] = [
  { k: "description", label: "الوصف", w: 180 },
  { k: "grade", label: "النوع", w: 110 },
  { k: "thickness_mm", label: "السمك", num: true },
  { k: "length_mm", label: "الطول", num: true },
  { k: "width_mm", label: "العرض", num: true },
  { k: "qty", label: "العدد", num: true },
  { k: "unit", label: "الوحدة", w: 70 },
  { k: "heat_no", label: "رقم الصبة", w: 120 },
  { k: "weight_kg", label: "الوزن كغم", num: true },
  { k: "unit_price", label: "سعر الوحدة", num: true },
];
const DOC: Record<string, string> = { mtc: "شهادة مواد", invoice: "فاتورة مورد", other: "مستند آخر" };

export function Scanner({ orders, canPlates, canInvoice, disabled }: { orders: { id: string; label: string }[]; canPlates: boolean; canInvoice: boolean; disabled?: boolean }) {
  const [r, setR] = useState<ScanResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [name, setName] = useState("");

  async function read(file: File | undefined) {
    if (!file) return;
    setErr("");
    setR(null);
    setName(file.name);
    setBusy(true);
    try {
      const fd = new FormData();
      const blob = await shrink(file);
      fd.append("file", blob, file.name);
      const res = await fetch("/api/ai/scan", { method: "POST", body: fd });
      const j = await res.json().catch(() => ({ error: "الرد غير مفهوم." }));
      if (j.error) setErr(j.error);
      else setR(j.result);
    } catch {
      setErr("انقطع الاتصال. تأكد من الإنترنت وجرّب مرة ثانية.");
    }
    setBusy(false);
  }

  const set = (patch: Partial<ScanResult>) => setR((x) => (x ? { ...x, ...patch } : x));
  const setItem = (i: number, k: keyof ScanItem, v: string, num?: boolean) =>
    setR((x) => (x ? { ...x, items: x.items.map((it, j) => (j === i ? { ...it, [k]: v === "" ? null : num ? Number(v) : v } : it)) } : x));
  const plateRows = r?.items.filter((x) => Number(x.thickness_mm) > 0 && Number(x.length_mm) > 0 && Number(x.width_mm) > 0).length ?? 0;

  return (
    <>
      <div className="panel" style={{ marginBottom: 14 }}>
        <label className="scan-drop">
          <input type="file" accept="image/*,application/pdf" disabled={disabled || busy} onChange={(e) => read(e.target.files?.[0])} />
          <b>{busy ? "جاري القراءة... (تاخذ 10 إلى 40 ثانية)" : "صوّر أو اختار الشهادة أو الفاتورة"}</b>
          <span className="meta">{name || "JPG أو PNG أو PDF، لحد 4 ميگا. خلي الصورة مستقيمة وواضحة."}</span>
        </label>
        {err && <div className="alert" style={{ marginTop: 12, marginBottom: 0 }}>{err}</div>}
      </div>

      {r && (
        <form action={saveScan}>
          <input type="hidden" name="data" value={JSON.stringify(r)} />
          <div className="panel">
            <div className="panel-h"><b>{DOC[r.doc_type] ?? "مستند"}: راجع وصحّح</b><span className="meta">الحقول الفارغة ما انقرت أو مو موجودة</span></div>
            <div className="fields">
              <label>المصنع أو المورد<input value={r.supplier ?? ""} onChange={(e) => set({ supplier: e.target.value || null })} /></label>
              <label>رقم الشهادة أو الفاتورة<input value={r.doc_no ?? ""} onChange={(e) => set({ doc_no: e.target.value || null })} /></label>
              <label>التاريخ<input type="date" value={r.date ?? ""} onChange={(e) => set({ date: e.target.value || null })} /></label>
              <label>المواصفة<input value={r.standard ?? ""} onChange={(e) => set({ standard: e.target.value || null })} /></label>
              {r.doc_type === "invoice" && (
                <>
                  <label>العملة
                    <select value={r.currency ?? "IQD"} onChange={(e) => set({ currency: e.target.value as "IQD" | "USD" })}><option value="IQD">دينار</option><option value="USD">دولار</option></select>
                  </label>
                  <label>المجموع بالفاتورة<input inputMode="decimal" value={r.total ?? ""} onChange={(e) => set({ total: e.target.value ? Number(e.target.value) : null })} /></label>
                </>
              )}
              {r.chemistry && <label className="full">التحليل الكيمياوي<input value={r.chemistry} onChange={(e) => set({ chemistry: e.target.value })} /></label>}
              {r.mechanical && <label className="full">الخواص الميكانيكية<input value={r.mechanical} onChange={(e) => set({ mechanical: e.target.value })} /></label>}
            </div>
            {r.notes && <div className="alert" style={{ marginTop: 14, marginBottom: 0, borderInlineStartColor: "var(--warn)", background: "var(--warn-bg, var(--chip))" }}>{r.notes}</div>}
          </div>

          <div className="tbl" style={{ marginTop: 14 }}>
            <table data-plain>
              <thead><tr>{COLS.map((c) => <th key={c.k}>{c.label}</th>)}<th /></tr></thead>
              <tbody>
                {r.items.map((it, i) => (
                  <tr key={i}>
                    {COLS.map((c) => (
                      <td key={c.k} style={{ padding: "6px 6px" }}>
                        <input
                          aria-label={c.label}
                          value={it[c.k] == null ? "" : String(it[c.k])}
                          inputMode={c.num ? "decimal" : undefined}
                          dir={c.num || c.k === "heat_no" ? "ltr" : undefined}
                          style={{ width: c.w ?? 84, padding: "6px 8px" }}
                          onChange={(e) => setItem(i, c.k, e.target.value, c.num)}
                        />
                      </td>
                    ))}
                    <td><button type="button" className="btn danger sm" onClick={() => set({ items: r.items.filter((_, j) => j !== i) })}>حذف</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="button" className="btn ghost sm" style={{ marginTop: 8 }} onClick={() => set({ items: [...r.items, { description: "", grade: null, thickness_mm: null, length_mm: null, width_mm: null, qty: 1, unit: null, heat_no: null, weight_kg: null, unit_price: null }] })}>+ سطر</button>

          <div className="panel" style={{ marginTop: 14 }}>
            <div className="panel-h"><b>وين تنحفظ؟</b></div>
            <div className="actions" style={{ marginTop: 0, paddingTop: 0, borderTop: 0, alignItems: "flex-end" }}>
              {canPlates && <button className="btn" name="to" value="plates" disabled={!plateRows}>أضف {plateRows ? `${r.items.filter((x) => Number(x.thickness_mm) > 0 && Number(x.length_mm) > 0 && Number(x.width_mm) > 0).reduce((a, x) => a + Math.max(1, Math.round(Number(x.qty) || 1)), 0)} لوح` : "الألواح"} لمخزن القص</button>}
              <label style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 13, color: "var(--muted)", minWidth: 200 }}>
                أمر العمل
                <select name="order_id" defaultValue=""><option value="">اختار...</option>{orders.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</select>
              </label>
              <button className="btn ghost" name="to" value="cert">احفظ كشهادة بملف الجودة</button>
              {canInvoice && <button className="btn ghost" name="to" value="invoice">سوّي فاتورة مشتريات مسودة</button>}
            </div>
          </div>
        </form>
      )}
    </>
  );
}
