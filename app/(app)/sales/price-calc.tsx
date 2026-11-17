"use client";

import { useState } from "react";
import { DENSITY, pieceWeight, SHAPES } from "@/lib/steel";

const fmt = (n: number, d = 0) => (Number.isFinite(n) ? n.toLocaleString("en-US", { maximumFractionDigits: d }) : "—");

// حاسبة السعر: الوزن × سعر الكيلو + ساعات المكائن + الأجور + كلف أخرى، ثم نسبة الربح
export function PriceCalc() {
  const [open, setOpen] = useState(false);
  const [shape, setShape] = useState("");
  const [v, setV] = useState<Record<string, string>>({ length: "6", margin: "20", pieces: "1" });
  const n = (k: string) => Number(v[k] || 0);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: e.target.value });
  const field = (k: string, label: string) => (
    <label key={k}>
      {label}
      <input type="number" inputMode="decimal" step="any" min="0" value={v[k] ?? ""} onChange={set(k)} />
    </label>
  );

  const s = shape ? SHAPES[shape] : null;
  const shapeWeight = s ? pieceWeight(shape, Object.fromEntries(s.fields.map((f) => [f.key, n(f.key)])), n("length"), DENSITY.steel.value) * (n("count") || 1) : 0;
  const weight = s ? shapeWeight : n("weight");
  const material = weight * (1 + n("waste") / 100) * n("kg_price");
  const machine = n("hours") * n("hour_rate");
  const cost = material + machine + n("labor") + n("other");
  const pieces = n("pieces") || 1;
  const price = cost * (1 + n("margin") / 100);
  const unitPrice = price / pieces;

  function apply() {
    const put = (id: string, val: string) => {
      const el = document.getElementById(id) as HTMLInputElement | HTMLSelectElement | null;
      if (el) el.value = val;
    };
    put("line_qty", String(pieces));
    put("line_unit", "قطعة");
    put("line_unit_price", String(Math.round(unitPrice)));
    document.getElementById("line_description")?.focus();
  }

  if (!open) {
    return (
      <button type="button" className="btn ghost" style={{ marginTop: 10 }} onClick={() => setOpen(true)}>
        حاسبة السعر من الوزن والكلفة
      </button>
    );
  }
  return (
    <div className="panel" style={{ marginTop: 10 }}>
      <div className="row between"><b>حاسبة السعر</b><button type="button" className="btn ghost sm" onClick={() => setOpen(false)}>إغلاق</button></div>
      <div className="fields" style={{ marginTop: 8 }}>
        <label>
          الوزن من
          <select value={shape} onChange={(e) => setShape(e.target.value)}>
            <option value="">أكتبه مباشرة (كغم)</option>
            {Object.entries(SHAPES).map(([k, x]) => <option key={k} value={k}>{x.label}</option>)}
          </select>
        </label>
        {s ? (
          <>
            {s.fields.map((f) => field(f.key, f.label))}
            {s.long && field("length", "الطول (متر)")}
            {field("count", "عدد القطع من هذا المقطع")}
          </>
        ) : (
          field("weight", "الوزن الكلي (كغم)")
        )}
        {field("kg_price", "سعر كيلو الحديد")}
        {field("waste", "نسبة الهدر %")}
        {field("hours", "ساعات المكائن")}
        {field("hour_rate", "كلفة ساعة الماكنة")}
        {field("labor", "أجور العمال")}
        {field("other", "صبغ وكلف أخرى")}
        {field("margin", "نسبة الربح %")}
        {field("pieces", "عدد القطع بالعرض")}
      </div>
      <div className="kpis" style={{ marginTop: 12 }}>
        <div className="kpi"><b>{fmt(weight, 1)}</b><span>الوزن (كغم)</span></div>
        <div className="kpi"><b>{fmt(cost)}</b><span>الكلفة</span></div>
        <div className="kpi"><b>{fmt(price)}</b><span>سعر البيع</span></div>
        <div className="kpi"><b>{fmt(unitPrice)}</b><span>سعر القطعة</span></div>
      </div>
      <div className="actions"><button type="button" className="btn" onClick={apply}>انقل السعر للبند</button></div>
    </div>
  );
}
