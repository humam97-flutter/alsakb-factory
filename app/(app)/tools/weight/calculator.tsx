"use client";

import { useState } from "react";
import { DENSITY, pieceWeight, SHAPES } from "@/lib/steel";

const fmt = (n: number, d = 2) => (Number.isFinite(n) ? n.toLocaleString("en-US", { maximumFractionDigits: d }) : "—");

export function Calculator() {
  const [shape, setShape] = useState("plate");
  const [density, setDensity] = useState("steel");
  const [vals, setVals] = useState<Record<string, string>>({ length: "6", qty: "1" });
  const s = SHAPES[shape];
  const n = (k: string) => Number(vals[k] || 0);
  const v = Object.fromEntries(s.fields.map((f) => [f.key, n(f.key)]));
  const one = pieceWeight(shape, v, n("length"), DENSITY[density].value);
  const qty = n("qty") || 0;
  const total = one * qty;
  const perKg = n("price");
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setVals({ ...vals, [k]: e.target.value });
  const num = (k: string, label: string) => (
    <label key={k}>
      {label}
      <input type="number" inputMode="decimal" step="any" min="0" value={vals[k] ?? ""} onChange={set(k)} />
    </label>
  );

  return (
    <div className="panel">
      <div className="fields">
        <label>
          الشكل
          <select value={shape} onChange={(e) => setShape(e.target.value)}>
            {Object.entries(SHAPES).map(([k, x]) => <option key={k} value={k}>{x.label}</option>)}
          </select>
        </label>
        <label>
          المعدن (الكثافة)
          <select value={density} onChange={(e) => setDensity(e.target.value)}>
            {Object.entries(DENSITY).map(([k, x]) => <option key={k} value={k}>{x.label}</option>)}
          </select>
        </label>
        {s.fields.map((f) => num(f.key, f.label))}
        {s.long && num("length", "الطول (متر)")}
        {num("qty", "العدد")}
        {num("price", "سعر الكيلو (اختياري)")}
      </div>
      <div className="kpis" style={{ marginTop: 14 }}>
        <div className="kpi"><b>{fmt(one, 3)}</b><span>وزن القطعة (كغم)</span></div>
        <div className="kpi"><b>{fmt(total, 2)}</b><span>الوزن الكلي (كغم)</span></div>
        <div className="kpi"><b>{fmt(total / 1000, 3)}</b><span>الوزن الكلي (طن)</span></div>
        {perKg > 0 && <div className="kpi"><b>{fmt(total * perKg, 0)}</b><span>الكلفة</span></div>}
      </div>
    </div>
  );
}
