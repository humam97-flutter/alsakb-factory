import type { Tone } from "@/lib/labels";

type Opt = { label: string; tone: Tone };

export function Pill({ map, value }: { map: Record<string, Opt>; value: string | null | undefined }) {
  if (!value || !map[value]) return null;
  return <span className={`pill tone-${map[value].tone}`}>{map[value].label}</span>;
}

export function Alert({ error, ok }: { error?: string; ok?: string }) {
  if (error) return <div className="alert" role="alert">{error}</div>;
  if (ok) return <div className="alert ok" role="status">{ok}</div>;
  return null;
}

export function Select({
  name,
  label,
  options,
  value,
  blank = true,
  full,
}: {
  name: string;
  label: string;
  options: Record<string, string> | string[];
  value?: string | null;
  blank?: boolean;
  full?: boolean;
}) {
  const entries = Array.isArray(options) ? options.map((o) => [o, o] as const) : Object.entries(options);
  return (
    <label className={full ? "full" : undefined}>
      {label}
      <select id={`f_${name}`} name={name} defaultValue={value ?? ""}>
        {blank && <option value=""></option>}
        {entries.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}

export function Input({
  name,
  label,
  value,
  type = "text",
  full,
  required,
}: {
  name: string;
  label: string;
  value?: string | number | null;
  type?: string;
  full?: boolean;
  required?: boolean;
}) {
  return (
    <label className={full ? "full" : undefined}>
      {label}
      <input
        id={`f_${name}`}
        name={name}
        type={type}
        defaultValue={value ?? ""}
        required={required}
        {...(type === "number" ? { step: "any", inputMode: "decimal" as const } : {})}
      />
    </label>
  );
}

export function TextArea({ name, label, value }: { name: string; label: string; value?: string | null }) {
  return (
    <label className="full">
      {label}
      <textarea id={`f_${name}`} name={name} defaultValue={value ?? ""} />
    </label>
  );
}

export function Checks({
  name,
  label,
  items,
  selected,
}: {
  name: string;
  label: string;
  items: { id: string; label: string }[];
  selected: string[];
}) {
  return (
    <div className="full fields" style={{ display: "block" }}>
      <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 4 }}>{label}</div>
      <div className="checks">
        {items.map((i) => (
          <label key={i.id}>
            <input type="checkbox" name={name} value={i.id} defaultChecked={selected.includes(i.id)} />
            {i.label}
          </label>
        ))}
      </div>
    </div>
  );
}

// يُستخدم مع searchParams في كل صفحة
export type PageProps = { searchParams: Promise<Record<string, string | undefined>> };
export type IdPageProps = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> };
