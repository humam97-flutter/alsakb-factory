import { Nav } from "@/components/nav";
import { can, requireRole } from "@/lib/auth";

export default async function AccountsLayout({ children }: { children: React.ReactNode }) {
  await requireRole(can.finance);
  return (
    <>
      <div className="subnav noprint">
        <Nav
          items={[
            { href: "/accounts/report", label: "التقرير الشهري" },
            { href: "/accounts/cash", label: "الصندوق" },
            { href: "/accounts/expenses", label: "المصاريف" },
          ]}
        />
      </div>
      {children}
    </>
  );
}
