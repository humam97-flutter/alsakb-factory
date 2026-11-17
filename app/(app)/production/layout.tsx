import { Nav } from "@/components/nav";

export default function ProductionLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="subnav noprint">
        <Nav
          items={[
            { href: "/production/schedule", label: "جدول المكائن" },
            { href: "/production/offcuts", label: "بقايا الصاج" },
            { href: "/production/scrap", label: "الهدر" },
          ]}
        />
      </div>
      {children}
    </>
  );
}
