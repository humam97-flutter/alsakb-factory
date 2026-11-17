import { Icon } from "@/components/icons";
import { Alert, type PageProps } from "@/components/ui";
import { signIn } from "./actions";

export default async function LoginPage({ searchParams }: PageProps) {
  const { error } = await searchParams;
  return (
    <div className="auth">
      <section className="auth-art" aria-hidden="true">
        <div className="brand-link">
          <span className="logo" />
          <span>
            <b>معمل السكب الحديدي</b>
            <small>نظام إدارة المعمل</small>
          </span>
        </div>
        <div>
          <h2>كل المعمل بمكان واحد</h2>
          <p>أوامر العمل والمكائن والمخزن والعمال والحسابات، محدثة لحظة بلحظة ومن أي جهاز.</p>
          <ul>
            <li><Icon name="orders" size={18} />متابعة الأوامر من الطلب لحد التسليم</li>
            <li><Icon name="machine" size={18} />حالة المكائن والصيانة الدورية</li>
            <li><Icon name="wallet" size={18} />المبيعات والمشتريات والأرباح الشهرية</li>
          </ul>
        </div>
        <small style={{ color: "var(--side-ink)" }}>© معمل السكب الحديدي</small>
      </section>
      <main className="auth-form">
        <div className="login">
          <h1>تسجيل الدخول</h1>
          <p className="meta" style={{ marginBottom: 20 }}>ادخل برقم هاتفك وكلمة السر.</p>
          <Alert error={error} />
          <form action={signIn} className="fields" style={{ gridTemplateColumns: "1fr" }}>
            <label>
              رقم الهاتف
              <input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="username" placeholder="07XXXXXXXXX" required />
            </label>
            <label>
              كلمة السر
              <input id="password" name="password" type="password" autoComplete="current-password" required />
            </label>
            <button className="btn" type="submit" style={{ marginTop: 6, padding: "11px 16px" }}>
              دخول
            </button>
          </form>
          <p className="meta" style={{ marginTop: 16 }}>الحسابات ينشئها المدير. إذا نسيت كلمة السر راجع المدير.</p>
        </div>
      </main>
    </div>
  );
}
