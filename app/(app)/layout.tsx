import Link from "next/link";
import { Suspense } from "react";
import { Enhance } from "@/components/enhance";
import { Icon } from "@/components/icons";
import { PageTitle, Sidebar, type NavGroup } from "@/components/nav";
import { Mark } from "@/components/letterhead";
import { getAlerts } from "@/lib/alerts";
import { getBrand } from "@/lib/brand";
import { can, getMe } from "@/lib/auth";
import { ROLE } from "@/lib/labels";
import { signOut } from "../login/actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await getMe();
  const r = me.role;
  const [alerts, brand] = await Promise.all([getAlerts(me), getBrand()]);
  const bad = alerts.filter((a) => a.level === "bad").length;
  const groups: NavGroup[] = [
    { items: [{ href: "/", label: "اللوحة الرئيسية", icon: "home" }, { href: "/assistant", label: "المساعد الذكي", icon: "spark" }] },
    {
      title: "التشغيل",
      items: [
        { href: "/orders", label: "أوامر العمل", icon: "orders" },
        { href: "/production", label: "الإنتاج والتخطيط", icon: "factory" },
        ...(can.stages(r) ? [{ href: "/floor", label: "شاشة الورشة", icon: "clock" }] : []),
        { href: "/cutting", label: "القص والألواح", icon: "cut" },
        { href: "/tools/engineering", label: "الحاسبات الهندسية", icon: "calc" },
        { href: "/quality", label: "الجودة واللحام", icon: "check" },
        { href: "/machines", label: "المكائن", icon: "machine" },
        { href: "/maintenance", label: "الصيانة", icon: "wrench" },
        { href: "/stock", label: "المخزن", icon: "stock" },
        ...(can.attendance(r) ? [{ href: "/workers", label: "العمال", icon: "workers" }] : []),
      ],
    },
    {
      title: "المالية",
      items: [
        ...(can.finance(r) ? [{ href: "/projects", label: "المشاريع والمناقصات", icon: "briefcase" }] : []),
        ...(can.finance(r) ? [{ href: "/sales", label: "المبيعات", icon: "sales" }] : []),
        ...(can.requests(r) ? [{ href: "/purchases", label: "المشتريات", icon: "cart" }] : []),
        ...(can.finance(r) ? [{ href: "/payroll", label: "الرواتب", icon: "money" }] : []),
        ...(can.finance(r) ? [{ href: "/accounts", label: "الحسابات", icon: "wallet" }] : []),
      ],
    },
    {
      title: "الإدارة",
      items: [
        ...(can.docs(r) ? [{ href: "/documents", label: "المستندات", icon: "docs" }] : []),
        { href: "/tools/weight", label: "حاسبة الوزن", icon: "scale" },
        ...(can.users(r) ? [{ href: "/users", label: "المستخدمون", icon: "users" }] : []),
        ...(can.users(r) ? [{ href: "/audit", label: "سجل التعديلات", icon: "history" }] : []),
        ...(can.users(r) ? [{ href: "/settings", label: "الإعدادات", icon: "settings" }] : []),
      ],
    },
  ].filter((g) => g.items.length);
  const initials = me.full_name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("");

  return (
    <div className="shell">
      <Sidebar
        groups={groups}
        brand={
          <Link href="/" className="brand-link">
            <Mark logo={brand.logo} />
            <span>
              <b>{brand.name}</b>
              <small>نظام إدارة المعمل</small>
            </span>
          </Link>
        }
        footer={
          <div className="me">
            <span className="avatar" aria-hidden="true">{initials}</span>
            <span className="me-txt">
              <b>{me.full_name}</b>
              <small>{ROLE[r]}</small>
            </span>
            <form action={signOut}>
              <button type="submit" className="icon-btn" aria-label="تسجيل الخروج" title="تسجيل الخروج">
                <Icon name="logout" size={18} />
              </button>
            </form>
          </div>
        }
      />
      <div className="content">
        <header className="topbar noprint">
          <PageTitle groups={groups} />
          <Link href="/alerts" className={`bell ${bad ? "has-bad" : alerts.length ? "has" : ""}`} aria-label={`التنبيهات: ${alerts.length}`} title="التنبيهات">
            <Icon name="bell" />
            {alerts.length > 0 && <span className="badge">{alerts.length}</span>}
          </Link>
        </header>
        <main className="wrap">{children}</main>
      </div>
      <Suspense>
        <Enhance />
      </Suspense>
    </div>
  );
}
