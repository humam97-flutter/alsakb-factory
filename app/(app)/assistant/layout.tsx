import { Nav } from "@/components/nav";
import { can, getMe } from "@/lib/auth";

export default async function AssistantLayout({ children }: { children: React.ReactNode }) {
  const me = await getMe();
  return (
    <>
      <div className="subnav noprint">
        <Nav
          items={[
            { href: "/assistant", label: "المساعد" },
            ...(me.role !== "operator" ? [{ href: "/assistant/scan", label: "قراءة الشهادات والفواتير" }] : []),
            ...(can.users(me.role) ? [{ href: "/assistant/usage", label: "الاستخدام والكلفة" }] : []),
          ]}
        />
      </div>
      {children}
    </>
  );
}
