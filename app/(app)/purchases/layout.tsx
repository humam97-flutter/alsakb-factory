import { Nav } from "@/components/nav";
import { can, requireRole } from "@/lib/auth";

export default async function PurchasesLayout({ children }: { children: React.ReactNode }) {
  const me = await requireRole(can.requests);
  const fin = can.finance(me.role);
  return (
    <>
      <div className="subnav noprint">
        <Nav
          items={[
            { href: "/purchases/requests", label: "طلبات الشراء" },
            { href: "/purchases/suppliers", label: "الموردين" },
            { href: "/purchases/prices", label: "أسعار الحديد" },
            ...(fin
              ? [
                  { href: "/purchases/invoices", label: "فواتير الشراء" },
                  { href: "/purchases/payments", label: "تسديد الموردين" },
                ]
              : []),
          ]}
        />
      </div>
      {children}
    </>
  );
}
