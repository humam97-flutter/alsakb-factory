import Link from "next/link";
import { Alert, Input, Pill, Select, type PageProps } from "@/components/ui";
import { Icon } from "@/components/icons";
import { getMe } from "@/lib/auth";
import { GRADES, PLATE_STATUS, plateKg } from "@/lib/cutting";
import { money, num, today } from "@/lib/labels";
import { supabase } from "@/lib/supabase/server";
import { deletePlate, savePlates } from "./actions";

// مخزن الألواح: كل لوح بقطعته (رقم، قياس، صب، شهادة)، والبقايا ترجع هنا تلقائياً بعد القص
export default async function PlatesPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const me = await getMe();
  const edit = ["manager", "production", "storekeeper"].includes(me.role);
  const db = await supabase();
  const status = sp.status ?? "stock";
  let q = db.from("plates").select("*, supplier:suppliers(name), parent:plates!parent_id(serial)").order("grade").order("thickness").order("length_mm", { ascending: false });
  if (status === "stock") q = q.neq("status", "cut");
  else if (status !== "all") q = q.eq("status", status);
  if (sp.t) q = q.eq("thickness", Number(sp.t));
  if (sp.grade) q = q.eq("grade", sp.grade);
  if (sp.rem === "1") q = q.not("parent_id", "is", null);
  const [{ data: rows }, { data: suppliers }, { data: stock }] = await Promise.all([
    q.limit(500),
    db.from("suppliers").select("id, name").order("name"),
    db.from("plates").select("grade, thickness, length_mm, width_mm, density, price_kg, status, parent_id").neq("status", "cut"),
  ]);
  const list = rows ?? [];
  const st = stock ?? [];
  const kg = st.reduce((a, p) => a + plateKg(p), 0);
  const value = st.reduce((a, p) => a + plateKg(p) * Number(p.price_kg), 0);
  const rems = st.filter((p) => p.parent_id).length;
  const thick = [...new Set(st.map((p) => Number(p.thickness)))].sort((a, b) => a - b);
  const grades = [...new Set([...GRADES, ...st.map((p) => p.grade)])];

  return (
    <>
      <Alert error={sp.error} ok={sp.ok} />
      <div className="kpis">
        <div className="kpi"><span className="kpi-ic tone-info"><Icon name="stock" size={18} /></span><span>ألواح بالمخزن</span><b>{num(st.length)}</b></div>
        <div className="kpi"><span className="kpi-ic"><Icon name="scale" size={18} /></span><span>الوزن الكلي</span><b>{num(Math.round(kg))} كغم</b></div>
        <div className="kpi"><span className="kpi-ic tone-ok"><Icon name="money" size={18} /></span><span>القيمة</span><b>{money(value)}</b></div>
        <Link className="kpi" href="/cutting?rem=1"><span className="kpi-ic tone-warn"><Icon name="cut" size={18} /></span><span>بقايا قابلة للاستخدام</span><b>{num(rems)}</b></Link>
      </div>

      <form className="bar" method="get">
        <h2>الألواح</h2>
        <select name="status" defaultValue={status} aria-label="الحالة" style={{ width: 150 }}>
          <option value="stock">بالمخزن</option>
          <option value="available">متوفر فقط</option>
          <option value="reserved">محجوز</option>
          <option value="cut">انقص</option>
          <option value="all">الكل</option>
        </select>
        <select name="grade" defaultValue={sp.grade ?? ""} aria-label="النوع" style={{ width: 140 }}>
          <option value="">كل الأنواع</option>
          {grades.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
        <select name="t" defaultValue={sp.t ?? ""} aria-label="السمك" style={{ width: 110 }}>
          <option value="">كل السماكات</option>
          {thick.map((t) => <option key={t} value={t}>{t} ملم</option>)}
        </select>
        <label className="row" style={{ gap: 4, fontSize: 13 }}><input type="checkbox" name="rem" value="1" defaultChecked={sp.rem === "1"} /> البقايا فقط</label>
        <button className="btn ghost" type="submit">عرض</button>
      </form>

      {!list.length ? (
        <div className="empty">ما بيه ألواح مسجلة{status !== "all" ? " بهذا الفلتر" : ""}. سجّل الألواح اللي توصل للمعمل من النموذج تحت.</div>
      ) : (
        <div className="tbl">
          <table>
            <thead>
              <tr><th className="n">#</th><th>النوع</th><th className="n">السمك</th><th className="n">الطول × العرض</th><th className="n">الوزن</th><th className="n">سعر الكغم</th><th>الصب / الشهادة</th><th>المكان</th><th>الحالة</th><th></th></tr>
            </thead>
            <tbody>
              {list.map((p) => {
                const parent = p.parent as { serial: number } | null;
                return (
                  <tr key={p.id}>
                    <td className="n num">{p.serial}</td>
                    <td>{p.grade}{parent && <div className="meta">بقية من #{parent.serial}</div>}</td>
                    <td className="n num">{num(p.thickness)}</td>
                    <td className="n num"><bdi className="ltr">{Number(p.length_mm)}×{Number(p.width_mm)}</bdi></td>
                    <td className="n num">{num(Math.round(plateKg(p) * 10) / 10)}</td>
                    <td className="n num">{money(p.price_kg)}</td>
                    <td className="num">{[p.heat_no, p.cert_no].filter(Boolean).join(" / ")}</td>
                    <td>{p.location}</td>
                    <td><Pill map={PLATE_STATUS} value={p.status} /></td>
                    <td>
                      {edit && p.status === "available" && (
                        <form action={deletePlate}>
                          <input type="hidden" name="id" value={p.id} />
                          <button className="btn ghost sm" type="submit" aria-label="حذف">×</button>
                        </form>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {edit && (
        <>
          <h3 className="sec">تسجيل ألواح واصلة</h3>
          <form action={savePlates} className="panel">
            <datalist id="grades">{grades.map((g) => <option key={g} value={g} />)}</datalist>
            <div className="fields">
              <Input name="grade" label="النوع (Grade)" value="A36" list="grades" required />
              <Input name="thickness" label="السمك (ملم)" type="number" required />
              <Input name="length_mm" label="الطول (ملم)" type="number" value={6000} required />
              <Input name="width_mm" label="العرض (ملم)" type="number" value={1500} required />
              <Input name="count" label="العدد (ألواح متشابهة)" type="number" value={1} />
              <Input name="price_kg" label="سعر الكغم (دينار)" type="number" />
              <Input name="heat_no" label="رقم الصب (Heat No.)" />
              <Input name="cert_no" label="رقم شهادة المصنع (MTC)" />
              <Select name="supplier_id" label="المورد" options={Object.fromEntries((suppliers ?? []).map((s) => [s.id, s.name]))} />
              <Input name="received_on" label="تاريخ الوصول" type="date" value={today()} />
              <Input name="location" label="المكان بالمعمل" />
              <Select name="density" label="المعدن" options={{ "7.85": "حديد كاربوني (7.85)", "7.93": "ستانلس (7.93)" }} value="7.85" blank={false} />
              <Input name="notes" label="ملاحظات" full />
            </div>
            <div className="actions"><button className="btn" type="submit">إضافة</button></div>
          </form>
          <p className="meta">رقم الصب والشهادة ينتقلون تلقائياً للبقايا، حتى تعرف أصل كل قطعة بملف الجودة.</p>
        </>
      )}
    </>
  );
}
