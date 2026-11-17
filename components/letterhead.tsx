import type { Brand } from "@/lib/brand";

// شعار المعمل: الصورة المرفوعة، أو الشعار المخطط إذا ماكو صورة
export function Mark({ logo, size = 36 }: { logo: string | null; size?: number }) {
  if (logo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={logo} alt="" width={size} height={size} className="mark" style={{ width: size, height: size }} />;
  }
  return <span className="logo" aria-hidden="true" style={{ width: size, height: size }} />;
}

// الترويسة الرسمية للمطبوعات: الشعار والاسم والعنوان يمين، ونوع الورقة ورقمها يسار
export function Letterhead({ brand, title, info }: { brand: Brand; title: string; info?: [string, React.ReactNode][] }) {
  return (
    <header className="lh">
      <div className="lh-id">
        <Mark logo={brand.logo} size={58} />
        <div>
          <div className="lh-name">{brand.name}</div>
          {brand.address && <div>{brand.address}</div>}
          <div className="lh-contact">
            {brand.phone && <span className="num">{brand.phone}</span>}
            {brand.email && <span className="num">{brand.email}</span>}
            {brand.reg_no && <span>رقم التسجيل: <span className="num">{brand.reg_no}</span></span>}
          </div>
        </div>
      </div>
      <div className="lh-doc">
        <div className="lh-title">{title}</div>
        {(info ?? []).filter(([, v]) => v !== null && v !== undefined && v !== "").map(([l, v]) => (
          <div key={l}>{l}: <span className={/^[\d\s\-#/.,:]+$/.test(String(v)) ? "num" : undefined}>{v}</span></div>
        ))}
      </div>
    </header>
  );
}

export function Signatures({ names, manager }: { names: string[]; manager?: string | null }) {
  return (
    <div className="sigs">
      {names.map((s) => (
        <div key={s}>
          <span>{s}</span>
          {s === "المدير" && manager && <small>{manager}</small>}
        </div>
      ))}
    </div>
  );
}
