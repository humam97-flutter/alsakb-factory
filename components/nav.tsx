"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "./icons";

export type NavItem = { href: string; label: string; icon: string };
export type NavGroup = { title?: string; items: NavItem[] };

const isActive = (path: string, href: string) => (href === "/" ? path === "/" : path === href || path.startsWith(href + "/"));

// القائمة الجانبية. بالموبايل تصير درج ينفتح من زر القائمة
export function Sidebar({ groups, brand, footer }: { groups: NavGroup[]; brand: React.ReactNode; footer: React.ReactNode }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);
  return (
    <>
      <button className="menu-btn" type="button" aria-label="القائمة" aria-expanded={open} onClick={() => setOpen(true)}>
        <Icon name="menu" />
      </button>
      <div className={`scrim ${open ? "on" : ""}`} onClick={() => setOpen(false)} aria-hidden="true" />
      <aside className={`side ${open ? "open" : ""}`}>
        <div className="side-brand">{brand}</div>
        <nav className="side-nav" aria-label="الأقسام">
          {groups.map((g, i) => (
            <div key={i} className="side-group">
              {g.title && <div className="side-title">{g.title}</div>}
              {g.items.map((it) => (
                <Link key={it.href} href={it.href} aria-current={isActive(path, it.href) ? "page" : undefined}>
                  <Icon name={it.icon} size={18} />
                  <span>{it.label}</span>
                </Link>
              ))}
            </div>
          ))}
        </nav>
        <div className="side-foot">{footer}</div>
      </aside>
    </>
  );
}

// عنوان الصفحة الحالية بالشريط العلوي، من نفس عناصر القائمة
export function PageTitle({ groups }: { groups: NavGroup[] }) {
  const path = usePathname();
  const all = groups.flatMap((g) => g.items);
  const hit = all.filter((i) => isActive(path, i.href)).sort((a, b) => b.href.length - a.href.length)[0];
  const extra: Record<string, string> = { "/alerts": "التنبيهات" };
  return <div className="crumb">{hit?.label ?? extra[path] ?? ""}</div>;
}

// تبويبات داخل القسم (المبيعات، المشتريات...)
export function Nav({ items }: { items: { href: string; label: string }[] }) {
  const path = usePathname();
  return (
    <nav className="tabs">
      {items.map((i) => {
        const active = i.href === "/" ? path === "/" : path.startsWith(i.href);
        return (
          <Link key={i.href} href={i.href} aria-current={active ? "page" : undefined}>
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
