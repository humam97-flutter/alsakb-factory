import { Nav } from "@/components/nav";

export default function QualityLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="subnav noprint">
        <Nav
          items={[
            { href: "/quality", label: "اللحامين ومؤهلاتهم" },
            { href: "/quality/wps", label: "إجراءات اللحام WPS" },
            { href: "/quality/ncr", label: "عدم المطابقة NCR" },
          ]}
        />
      </div>
      {children}
    </>
  );
}
