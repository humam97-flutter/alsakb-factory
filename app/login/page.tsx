import { Alert, type PageProps } from "@/components/ui";
import { signIn } from "./actions";

export default async function LoginPage({ searchParams }: PageProps) {
  const { error } = await searchParams;
  return (
    <main className="wrap">
      <div className="login">
        <div className="row" style={{ marginBottom: 20 }}>
          <div className="logo" aria-hidden="true" />
          <h1 style={{ fontFamily: "var(--f-display)", margin: 0, fontSize: 22 }}>معمل السكب الحديدي</h1>
        </div>
        <Alert error={error} />
        <form action={signIn} className="panel fields" style={{ gridTemplateColumns: "1fr" }}>
          <label>
            رقم الهاتف
            <input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="username" placeholder="07XXXXXXXXX" required />
          </label>
          <label>
            كلمة السر
            <input id="password" name="password" type="password" autoComplete="current-password" required />
          </label>
          <button className="btn" type="submit">
            دخول
          </button>
        </form>
        <p className="meta" style={{ marginTop: 12 }}>الحسابات ينشئها المدير. إذا نسيت كلمة السر راجع المدير.</p>
      </div>
    </main>
  );
}
