import { Alert, Input, Select, type PageProps } from "@/components/ui";
import { can, requireRole } from "@/lib/auth";
import { ROLE } from "@/lib/labels";
import { supabase } from "@/lib/supabase/server";
import { createUser, updateUser } from "./actions";

export default async function UsersPage({ searchParams }: PageProps) {
  await requireRole(can.users);
  const { error, ok } = await searchParams;
  const db = await supabase();
  const { data: users } = await db.from("profiles").select("*").order("full_name");
  return (
    <>
      <Alert error={error} ok={ok} />
      <div className="bar"><h2>المستخدمون</h2></div>
      <div className="tbl">
        <table>
          <thead><tr><th>الاسم</th><th>الهاتف</th><th>الدور</th><th>الحالة</th><th>كلمة سر جديدة</th><th></th></tr></thead>
          <tbody>
            {(users ?? []).map((u) => (
              <tr key={u.id}>
                <td>{u.full_name}</td>
                <td className="num">{u.phone}</td>
                <td colSpan={4}>
                  <form action={updateUser} className="row" style={{ flexWrap: "nowrap" }}>
                    <input type="hidden" name="id" value={u.id} />
                    <select name="role" defaultValue={u.role} aria-label="الدور" style={{ width: 150 }}>
                      {Object.entries(ROLE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                    <select name="active" defaultValue={u.active ? "yes" : "no"} aria-label="الحالة" style={{ width: 110 }}>
                      <option value="yes">فعّال</option>
                      <option value="no">موقوف</option>
                    </select>
                    <input name="password" type="text" placeholder="اتركه فارغاً" aria-label="كلمة سر جديدة" style={{ width: 140 }} />
                    <button className="btn ghost sm" type="submit">حفظ</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 className="sec">إضافة مستخدم</h3>
      <form action={createUser} className="panel">
        <div className="fields">
          <Input name="full_name" label="الاسم" required />
          <Input name="phone" label="رقم الهاتف (اسم الدخول)" type="tel" required />
          <Select name="role" label="الدور" options={ROLE} value="operator" blank={false} />
          <Input name="password" label="كلمة السر (6 أحرف أو أكثر)" required />
        </div>
        <div className="actions"><button className="btn" type="submit">إنشاء الحساب</button></div>
      </form>
      <p className="meta">المدير يشوف كل شي. مدير الإنتاج بدون أسعار. أمين المخزن للمخزن. المحاسب للمال والرواتب. المشغل يحدّث مراحل الشغل ويبلّغ عن الأعطال.</p>
    </>
  );
}
