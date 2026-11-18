import { Nav } from "@/components/nav";
import { can, requireRole } from "@/lib/auth";

export default async function ProjectsLayout({ children }: { children: React.ReactNode }) {
  await requireRole(can.finance);
  return (
    <>
      <div className="subnav noprint">
        <Nav
          items={[
            { href: "/projects", label: "المشاريع" },
            { href: "/projects/guarantees", label: "خطابات الضمان" },
            { href: "/projects/tenders", label: "المناقصات" },
          ]}
        />
      </div>
      {children}
    </>
  );
}
