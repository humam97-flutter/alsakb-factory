import { Nav } from "@/components/nav";
import Link from "next/link";
import { getAlerts } from "@/lib/alerts";
import { can, getMe } from "@/lib/auth";
import { ROLE } from "@/lib/labels";
import { signOut } from "../login/actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await getMe();
  const r = me.role;
  const alerts = await getAlerts(me);
  const bad = alerts.filter((a) => a.level === "bad").length;
  const items = [
    { href: "/", label: "اللوحة" },
    { href: "/orders", label: "أوامر العمل" },
    { href: "/stock", label: "المخزن" },
    { href: "/machines", label: "المكائن" },
    { href: "/maintenance", label: "الصيانة" },
    { href: "/production", label: "الإنتاج" },
    ...(can.attendance(r) ? [{ href: "/workers", label: "العمال" }] : []),
    ...(can.finance(r) ? [{ href: "/sales", label: "المبيعات" }] : []),
    ...(can.requests(r) ? [{ href: "/purchases", label: "المشتريات" }] : []),
    ...(can.finance(r) ? [{ href: "/payroll", label: "الرواتب" }] : []),
    ...(can.finance(r) ? [{ href: "/accounts", label: "الحسابات" }] : []),
    ...(can.docs(r) ? [{ href: "/documents", label: "المستندات" }] : []),
    { href: "/tools/weight", label: "حاسبة الوزن" },
    ...(can.users(r) ? [{ href: "/users", label: "المستخدمون" }] : []),
    ...(can.users(r) ? [{ href: "/audit", label: "سجل التعديلات" }] : []),
    ...(can.users(r) ? [{ href: "/settings", label: "الإعدادات" }] : []),
  ];
  return (
    <>
      <header className="top">
        <div className="wrap">
          <div className="brand">
            <div className="logo" aria-hidden="true" />
            <h1>معمل السكب الحديدي</h1>
            <Link href="/alerts" className={`bell ${bad ? "has-bad" : alerts.length ? "has" : ""}`} aria-label={`التنبيهات: ${alerts.length}`}>
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22Zm7-6V11a7 7 0 0 0-5.5-6.84V3.5a1.5 1.5 0 0 0-3 0v.66A7 7 0 0 0 5 11v5l-2 2v1h18v-1l-2-2Z"/></svg>
              {alerts.length > 0 && <span className="num">{alerts.length}</span>}
            </Link>
            <div className="who">
              {me.full_name} · {ROLE[r]}
              <form action={signOut}>
                <button type="submit">خروج</button>
              </form>
            </div>
          </div>
          <Nav items={items} />
        </div>
      </header>
      <main className="wrap">{children}</main>
    </>
  );
}
