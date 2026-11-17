import { Nav } from "@/components/nav";

export default function EngLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="subnav noprint">
        <Nav
          items={[
            { href: "/tools/engineering", label: "وعاء ضغط" },
            { href: "/tools/engineering/tank", label: "خزان عمودي API 650" },
            { href: "/tools/engineering/dip", label: "جدول عمق خزان أفقي" },
            { href: "/tools/engineering/weld", label: "اللحام والصبغ" },
            { href: "/tools/engineering/saved", label: "الحسابات المحفوظة" },
          ]}
        />
      </div>
      {children}
    </>
  );
}
