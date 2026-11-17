import { Nav } from "@/components/nav";
import { can, requireRole } from "@/lib/auth";

export default async function SalesLayout({ children }: { children: React.ReactNode }) {
  await requireRole(can.finance);
  return (
    <>
      <div className="subnav noprint">
        <Nav
          items={[
            { href: "/sales/customers", label: "الزبائن" },
            { href: "/sales/estimates", label: "التسعير التقديري" },
            { href: "/sales/quotes", label: "عروض الأسعار" },
            { href: "/sales/invoices", label: "الفواتير" },
            { href: "/sales/payments", label: "المقبوضات" },
          ]}
        />
      </div>
      {children}
    </>
  );
}
