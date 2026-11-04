import { Nav } from "@/components/nav";
import { can, getMe } from "@/lib/auth";
import { ROLE } from "@/lib/labels";
import { signOut } from "../login/actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await getMe();
  const r = me.role;
  const items = [
    { href: "/", label: "اللوحة" },
    { href: "/orders", label: "أوامر العمل" },
    { href: "/stock", label: "المخزن" },
    { href: "/machines", label: "المكائن" },
    { href: "/maintenance", label: "الصيانة" },
    ...(can.attendance(r) ? [{ href: "/workers", label: "العمال" }] : []),
    ...(can.finance(r) ? [{ href: "/payroll", label: "الرواتب" }] : []),
    ...(can.users(r) ? [{ href: "/users", label: "المستخدمون" }] : []),
  ];
  return (
    <>
      <header className="top">
        <div className="wrap">
          <div className="brand">
            <div className="logo" aria-hidden="true" />
            <h1>معمل السكب الحديدي</h1>
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
