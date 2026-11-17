import { Nav } from "@/components/nav";

export default function CuttingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="subnav noprint">
        <Nav
          items={[
            { href: "/cutting", label: "الألواح" },
            { href: "/cutting/plans", label: "مخططات القص" },
            { href: "/cutting/report", label: "تقرير الهدر والخسارة" },
          ]}
        />
      </div>
      {children}
    </>
  );
}
