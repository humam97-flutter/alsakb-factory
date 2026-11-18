"use client";

import { useMemo, useState } from "react";
import { GeomShape, NestSvg, YieldBar } from "@/components/nest-svg";
import { CUT_MACHINE, type CutMachine, type CutRates } from "@/lib/cut-cost";
import { costDrawing, JOB_TYPE, type DrawPart } from "@/lib/drawing-cost";
import { extractParts, guessFrames, parseDxf, svgPath, type DxfModel, type Geom } from "@/lib/dxf-import";
import { CATEGORY, type Rates } from "@/lib/estimate";
import { kgOf, type CutSettings, type Plate } from "@/lib/nesting";
import type { Center } from "@/lib/planning";
import { saveDrawing } from "./actions";

const n0 = (x: number) => Math.round(x).toLocaleString("en-US");
const n1 = (x: number) => (Math.round(x * 10) / 10).toLocaleString("en-US");

function Mini({ g, w, h }: { g: Geom; w: number; h: number }) {
  const pad = Math.max(w, h) * 0.04;
  return (
    <svg viewBox={`${-pad} ${-pad} ${w + 2 * pad} ${h + 2 * pad}`} width="56" height="40" className="nest" style={{ background: "transparent", border: 0 }} aria-hidden="true">
      <g style={{ ["--c" as string]: "var(--nest-0)" }}><GeomShape g={g} /></g>
    </svg>
  );
}

export function Importer(props: {
  plates: Plate[];
  settings: CutSettings & { scrapPrice: number };
  rates: Rates;
  cut: CutRates;
  centers: Center[];
  customers: { id: string; name: string }[];
  grades: string[];
  priceKg: number;
  priceNote: string;
  finance: boolean;
  production: boolean;
}) {
  const [file, setFile] = useState("");
  const [text, setText] = useState("");
  const [err, setErr] = useState("");
  const [unit, setUnit] = useState<number | undefined>(undefined);
  const [ignore, setIgnore] = useState<Set<number>>(new Set());
  const [edits, setEdits] = useState<Record<string, Partial<DrawPart>>>({});
  const [grade, setGrade] = useState("A36");
  const [thick, setThick] = useState(10);
  const [sets, setSets] = useState(1);
  const [job, setJob] = useState("cut_only");
  const [machine, setMachine] = useState<CutMachine>(props.cut.machine);
  const [useStock, setUseStock] = useState(true);
  const [priceKg, setPriceKg] = useState(props.priceKg);

  const parsed = useMemo((): { m: DxfModel | null; e: string } => {
    if (!text) return { m: null, e: "" };
    try {
      return { m: parseDxf(text, unit), e: "" };
    } catch (e) {
      return { m: null, e: e instanceof Error ? e.message : "ما كدرنا نقرأ الملف." };
    }
  }, [text, unit]);
  const model = parsed.m;
  const error = err || parsed.e || (model && !model.loops.length ? "ما لكينا ولا حدود مغلقة بالملف. تأكد إن القطع مرسومة بخطوط أو Polyline مسكّرة." : "");

  const extracted = useMemo(() => (model ? extractParts(model, ignore) : []), [model, ignore]);
  const parts: DrawPart[] = useMemo(
    () =>
      extracted.map((p) => ({
        key: p.key, name: p.name, shape: p.shape, w: p.w, h: p.h, diameter: p.diameter, inner: p.inner, area: p.area, cutLen: p.cutLen, pierces: p.pierces, holes: p.holes, qty: p.qty,
        thickness: p.thickness ?? thick, grade, geom: p.geom, include: true,
        ...edits[p.key],
      })),
    [extracted, edits, thick, grade],
  );
  const res = useMemo(() => {
    if (!parts.some((p) => p.include)) return null;
    return costDrawing({ parts, sets, job, useStock, plates: props.plates, settings: props.settings, cut: { ...props.cut, machine }, rates: props.rates, priceKg, centers: props.centers });
  }, [parts, sets, job, useStock, machine, priceKg, props]);

  const geoms = useMemo(() => Object.fromEntries(parts.filter((p) => p.shape === "poly" || p.holes > (p.shape === "ring" ? 1 : 0)).map((p) => [p.key, p.geom])), [parts]);
  const edit = (key: string, patch: Partial<DrawPart>) => setEdits((e) => ({ ...e, [key]: { ...e[key], ...patch } }));

  async function load(f: File | undefined) {
    if (!f) return;
    setFile(f.name);
    setEdits({});
    setUnit(undefined);
    setErr("");
    if (/\.dwg$/i.test(f.name)) {
      setText("");
      setErr("ملف DWG ما ينقرى مباشرة. من AutoCAD سوّي Save As واختار DXF (أي إصدار)، وارفع الملف الجديد.");
      return;
    }
    const t = await f.text();
    setText(t);
    try {
      const m = parseDxf(t);
      setIgnore(new Set(guessFrames(m)));
    } catch {
      setIgnore(new Set());
    }
  }

  // الرسم الأصلي: كل الحدود، القطع ملونة والمتجاهلة متقطعة. الضغط على حدود يتجاهلها أو يرجعها
  const view = useMemo(() => {
    if (!model || !model.loops.length) return null;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const l of model.loops) {
      x0 = Math.min(x0, l.box[0]); y0 = Math.min(y0, l.box[1]); x1 = Math.max(x1, l.box[2]); y1 = Math.max(y1, l.box[3]);
    }
    const keyOf = new Map<number, string>();
    extracted.forEach((p) => p.loopIds.forEach((id) => keyOf.set(id, p.key)));
    return { x0, y0, x1, y1, keyOf };
  }, [model, extracted]);

  const payload = res
    ? JSON.stringify({ file, sets, job, grade, useStock, priceKg, machine, parts: parts.filter((p) => p.include) })
    : "";

  return (
    <>
      <div className="panel" style={{ marginBottom: 14 }}>
        <label className="scan-drop">
          <input type="file" accept=".dxf,.dwg" onChange={(e) => load(e.target.files?.[0])} />
          <b>{file ? `الملف: ${file}` : "اختار ملف المخطط (DXF)"}</b>
          <span className="meta">ارسم القطع بالقياس الحقيقي (1:1). كل قطعة حدودها مغلقة، والفتحات جواها. الأبعاد والنصوص والإطار يتجاهلها النظام.</span>
        </label>
        {error && <div className="alert" style={{ marginTop: 12, marginBottom: 0 }}>{error}</div>}
        {model && (
          <div className="row" style={{ marginTop: 12, gap: 14, fontSize: 13.5, flexWrap: "wrap" }}>
            <span>الوحدة: <b>{model.units}</b></span>
            <label className="row" style={{ gap: 6 }}>تغيير
              <select value={unit ?? ""} onChange={(e) => setUnit(e.target.value === "" ? undefined : Number(e.target.value))} style={{ width: "auto", padding: "4px 8px" }}>
                <option value="">من الملف</option><option value="4">ملم</option><option value="5">سم</option><option value="6">متر</option><option value="1">إنج</option>
              </select>
            </label>
            <span>{model.loops.length} حدود مغلقة</span>
            {model.open > 0 && <span style={{ color: "var(--warn)" }}>⚠ {model.open} خط مفتوح ما انربط (تأكد إن الحدود مسكّرة)</span>}
            {ignore.size > 0 && <span>تجاهلنا {ignore.size} إطار <button type="button" className="btn ghost sm" onClick={() => setIgnore(new Set())}>رجّعه</button></span>}
          </div>
        )}
      </div>

      {model && view && (
        <div className="panel" style={{ marginBottom: 14 }}>
          <div className="panel-h"><b>الرسم</b><span className="meta">اضغط على أي حدود حتى تتجاهلها (إطار أو رسم مو للقص) أو ترجعها</span></div>
          <svg className="nest" viewBox={`${view.x0 - 20} ${-view.y1 - 20} ${view.x1 - view.x0 + 40} ${view.y1 - view.y0 + 40}`} style={{ maxHeight: 420, width: "100%" }} role="img" aria-label="معاينة المخطط">
            {model.loops.map((l) => {
              const ign = ignore.has(l.id);
              const k = view.keyOf.get(l.id);
              const idx = k ? parseInt(k.slice(1), 10) - 1 : 0;
              return (
                <path
                  key={l.id}
                  d={svgPath(l.pts.map(([x, y]) => [x, -y]))}
                  onClick={() => setIgnore((s) => { const n = new Set(s); if (n.has(l.id)) n.delete(l.id); else n.add(l.id); return n; })}
                  style={{ cursor: "pointer", fill: ign ? "none" : `color-mix(in srgb, var(--nest-${idx % 6}) 22%, transparent)`, stroke: ign ? "var(--muted)" : `var(--nest-${idx % 6})`, strokeDasharray: ign ? "12 8" : undefined, strokeWidth: 2, vectorEffect: "non-scaling-stroke", fillRule: "evenodd" }}
                >
                  <title>{ign ? "متجاهل: اضغط حتى ترجعه" : k ? `${k}: اضغط حتى تتجاهله` : ""}</title>
                </path>
              );
            })}
          </svg>
        </div>
      )}

      {parts.length > 0 && (
        <>
          <div className="panel" style={{ marginBottom: 14 }}>
            <div className="panel-h"><b>نوع الشغل والمادة</b></div>
            <div className="fields">
              <label>نوع الشغل<select value={job} onChange={(e) => setJob(e.target.value)}>{Object.entries(JOB_TYPE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
              <label>كم نسخة من المخطط<input type="number" min={1} value={sets} onChange={(e) => setSets(Math.max(1, Number(e.target.value) || 1))} /></label>
              <label>نوع الصاج (لكل القطع)<input list="grades" value={grade} onChange={(e) => { setGrade(e.target.value); setEdits((x) => Object.fromEntries(Object.entries(x).map(([k, v]) => [k, { ...v, grade: undefined }]))); }} /></label>
              <label>السمك الافتراضي (ملم)<input type="number" step="any" value={thick} onChange={(e) => setThick(Number(e.target.value) || 0)} /><small>إذا السمك مكتوب باسم الطبقة (مثل T12) ياخذه منها</small></label>
              <label>ماكنة القص<select value={machine} onChange={(e) => setMachine(e.target.value as CutMachine)}>{Object.entries(CUT_MACHINE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
              <label>سعر كغم الصاج للشراء (دينار)<input type="number" value={priceKg} onChange={(e) => setPriceKg(Number(e.target.value) || 0)} /><small>{props.priceNote}</small></label>
              <label className="row" style={{ flexDirection: "row", alignItems: "center", gap: 8, color: "var(--ink)" }}><input type="checkbox" checked={useStock} onChange={(e) => setUseStock(e.target.checked)} /> استعمل الألواح والبقايا الموجودة بالمخزن أولاً</label>
            </div>
            <datalist id="grades">{props.grades.map((g) => <option key={g} value={g} />)}</datalist>
          </div>

          <h3 className="sec">القطع ({parts.length} نوع، {parts.reduce((a, p) => a + (p.include ? p.qty : 0), 0) * sets} قطعة)</h3>
          <div className="tbl" style={{ marginBottom: 14 }}>
            <table data-plain>
              <thead><tr><th /><th>الرمز</th><th /><th>الاسم</th><th className="n">القياس</th><th className="n">فتحات</th><th className="n">قص م</th><th className="n">وزن القطعة</th><th>السمك</th><th>النوع</th><th>العدد</th></tr></thead>
              <tbody>
                {parts.map((p) => (
                  <tr key={p.key} style={{ opacity: p.include ? 1 : 0.45 }}>
                    <td><input type="checkbox" checked={p.include} onChange={(e) => edit(p.key, { include: e.target.checked })} aria-label="تدخل بالحساب" /></td>
                    <td className="num">{p.key}</td>
                    <td><Mini g={p.geom} w={p.w} h={p.h} /></td>
                    <td><input value={p.name} onChange={(e) => edit(p.key, { name: e.target.value })} style={{ minWidth: 130, padding: "6px 8px" }} /></td>
                    <td className="n num"><bdi className="ltr">{p.shape === "circle" || p.shape === "ring" ? `Ø${p.diameter}${p.inner ? ` / Ø${p.inner}` : ""}` : `${n1(p.w)}×${n1(p.h)}`}</bdi></td>
                    <td className="n num">{p.holes || ""}</td>
                    <td className="n num">{n1(p.cutLen / 1000)}</td>
                    <td className="n num">{n1(kgOf(p.area, p.thickness, 7.85))}</td>
                    <td><input type="number" step="any" value={p.thickness} onChange={(e) => edit(p.key, { thickness: Number(e.target.value) || 0 })} style={{ width: 70, padding: "6px 8px" }} /></td>
                    <td><input list="grades" value={p.grade} onChange={(e) => edit(p.key, { grade: e.target.value })} style={{ width: 110, padding: "6px 8px" }} /></td>
                    <td><input type="number" min={1} value={p.qty} onChange={(e) => edit(p.key, { qty: Math.max(1, Number(e.target.value) || 1) })} style={{ width: 64, padding: "6px 8px" }} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {res && (
        <>
          <div className="kpis">
            <div className="kpi"><span>الألواح</span><b className="num">{res.totals.sheets}</b><span className="meta">{res.totals.buy ? `${res.totals.buy} شراء، ${res.totals.sheets - res.totals.buy} من المخزن` : "كلها من المخزن"}</span></div>
            <div className="kpi"><span>الاستغلال</span><b className="num">{(res.totals.yield * 100).toFixed(1)}%</b><span className="meta">{`هدر ${n0(res.totals.scrapKg)} كغم · بقايا ${n0(res.totals.remnantKg)} كغم`}</span></div>
            <div className="kpi"><span>وقت القص</span><b className="num">{n1(res.totals.cutHours)} ساعة</b><span className="meta">{`${n1(res.totals.cutLen / 1000)} م قص · ${n0(res.totals.pierces)} ثقب`}</span></div>
            <div className="kpi"><span>مدة الشغل</span><b className="num">{res.totals.days} يوم</b><span className="meta">{`${n0(res.totals.hours)} ساعة عمل`}</span></div>
            {props.finance && <div className="kpi"><span>السعر المقترح</span><b className="num">{n0(res.totals.price)}</b><span className="meta">{`الكلفة ${n0(res.totals.cost)} دينار`}</span></div>}
          </div>

          {res.unplaced.length > 0 && <div className="alert">قطع أكبر من الألواح القياسية: {res.unplaced.map((u) => `${u.part.name} (${u.qty})`).join("، ")}. ضيف قياس لوح أكبر من إعدادات القص أو قسّم القطعة.</div>}

          <h3 className="sec">ترتيب القطع على الألواح</h3>
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(420px, 100%), 1fr))", marginBottom: 14 }}>
            {res.layouts.slice(0, 12).map((l, i) => (
              <div className="nest-card" key={i}>
                <div className="nest-head">
                  <h3>{l.virtual ? "لوح جديد (شراء)" : `لوح #${l.plate.serial}`} · {l.plate.grade} · {Number(l.plate.thickness)} ملم · <bdi className="num ltr">{Number(l.plate.length_mm)}×{Number(l.plate.width_mm)}</bdi></h3>
                  <span className="meta num">{(l.yield * 100).toFixed(1)}%</span>
                </div>
                <NestSvg L={Number(l.plate.length_mm)} W={Number(l.plate.width_mm)} placed={l.placed} remnants={l.remnants} edge={props.settings.edge} geoms={geoms} />
                <div style={{ marginTop: 6 }}><YieldBar parts={l.parts_kg} remnant={l.remnant_kg} scrap={l.scrap_kg} /></div>
              </div>
            ))}
          </div>
          {res.layouts.length > 12 && <p className="meta">و{res.layouts.length - 12} لوح ثاني. كلها تطلع بأمر العمل.</p>}

          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(320px, 100%), 1fr))", marginBottom: 14 }}>
            <div className="tbl">
              <table data-plain>
                <thead><tr><th>المرحلة</th><th className="n">ساعات</th><th className="n">أيام</th></tr></thead>
                <tbody>
                  {res.stages.map((s) => <tr key={s.name}><td>{s.name}</td><td className="n num">{n1(s.hours)}</td><td className="n num">{s.days}</td></tr>)}
                  <tr><td><b>المجموع</b></td><td className="n num"><b>{n1(res.totals.hours)}</b></td><td className="n num"><b>{res.totals.days}</b></td></tr>
                </tbody>
              </table>
            </div>
            <div className="tbl">
              <table data-plain>
                <thead><tr><th>السمك</th><th className="n">ألواح</th><th className="n">صافي كغم</th><th className="n">ماكنة</th><th className="n">دقيقة قص</th></tr></thead>
                <tbody>
                  {res.groups.map((g) => (
                    <tr key={g.grade + g.thickness}><td>{g.grade} · {g.thickness} ملم</td><td className="n num">{g.plates}</td><td className="n num">{n0(g.netKg)}</td><td className="n">{CUT_MACHINE[g.cut.machine]} <span className="meta num">{n0(g.cut.speed)} ملم/د</span></td><td className="n num">{n0(g.cut.minutes)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {props.finance && (
            <div className="tbl" style={{ marginBottom: 14 }}>
              <table data-plain>
                <thead><tr><th>البند</th><th>النوع</th><th className="n">الكمية</th><th className="n">سعر الوحدة</th><th className="n">المبلغ</th></tr></thead>
                <tbody>
                  {res.lines.map((l, i) => (
                    <tr key={i}><td style={{ whiteSpace: "normal" }}>{l.description}</td><td>{CATEGORY[l.category]}</td><td className="n num">{n1(l.qty)} <span className="meta">{l.unit}</span></td><td className="n num">{n0(l.unit_cost)}</td><td className="n num">{n0(l.qty * l.unit_cost)}</td></tr>
                  ))}
                  <tr><td colSpan={4}>الكلفة المباشرة</td><td className="n num">{n0(res.totals.direct)}</td></tr>
                  <tr><td colSpan={4}>{`+ مصاريف عامة ${props.rates.overhead_pct}% واحتياط ${props.rates.contingency_pct}%`}</td><td className="n num">{n0(res.totals.cost)}</td></tr>
                  <tr><td colSpan={4}><b>{`السعر مع ربح ${props.rates.margin_pct}%`}</b></td><td className="n num"><b>{n0(res.totals.price)}</b></td></tr>
                </tbody>
              </table>
            </div>
          )}

          <form action={saveDrawing} className="panel">
            <input type="hidden" name="data" value={payload} />
            <div className="panel-h"><b>احفظ واشتغل عليه</b></div>
            <div className="fields">
              <label>العنوان<input name="title" defaultValue={file.replace(/\.dxf$/i, "")} required /></label>
              <label>الزبون<select name="customer_id" defaultValue=""><option value="">بدون</option>{props.customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
            </div>
            <div className="actions">
              {props.finance && <button className="btn" name="to" value="estimate">احفظ كتسعيرة</button>}
              {props.production && <button className="btn" name="to" value="order">سوّي أمر عمل مع القطع والخطة</button>}
              {props.finance && props.production && <button className="btn ghost" name="to" value="both">الاثنين</button>}
            </div>
            <p className="meta" style={{ marginBottom: 0 }}>أمر العمل ياخذ القطع بأشكالها (تنزل DXF للـ CNC من مخططات القص)، والمراحل تنخطط بالساعات المحسوبة على مراكز العمل.</p>
          </form>
        </>
      )}
    </>
  );
}
