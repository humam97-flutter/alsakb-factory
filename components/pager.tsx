import Link from "next/link";

// تقسيم القوائم الطويلة لصفحات. نجيب صف زيادة حتى نعرف إذا اكو صفحة بعدها
export const PAGE_SIZE = 50;

export function paging(sp: Record<string, string | undefined>) {
  const page = Math.max(1, Number(sp.page) || 1);
  const from = (page - 1) * PAGE_SIZE;
  return { page, from, to: from + PAGE_SIZE };
}

export function cut<T>(rows: T[] | null | undefined) {
  const list = rows ?? [];
  return { rows: list.slice(0, PAGE_SIZE), more: list.length > PAGE_SIZE };
}

export function Pager({ page, more, sp, path }: { page: number; more: boolean; sp: Record<string, string | undefined>; path: string }) {
  if (page === 1 && !more) return null;
  const href = (p: number) => {
    const q = new URLSearchParams(Object.entries(sp).filter(([k, v]) => v && k !== "page" && k !== "ok" && k !== "error") as [string, string][]);
    if (p > 1) q.set("page", String(p));
    const s = q.toString();
    return s ? `${path}?${s}` : path;
  };
  return (
    <nav className="pager noprint" aria-label="الصفحات">
      {page > 1 ? <Link className="btn ghost sm" href={href(page - 1)}>→ السابقة</Link> : <span />}
      <span className="meta">صفحة <span className="num">{page}</span></span>
      {more ? <Link className="btn ghost sm" href={href(page + 1)}>التالية ←</Link> : <span />}
    </nav>
  );
}
