"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";

// تحسينات عامة لكل الصفحات بدون ما نعدل كل صفحة:
// 1) بحث سريع وترتيب بالضغط على عنوان العمود لكل جدول
// 2) تأكيد قبل أي حذف
const norm = (s: string) => s.replace(/[ً-ْ]/g, "").replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").toLowerCase();
const asNum = (s: string) => {
  const t = s.replace(/[,\s]/g, "").replace(/[^\d.\-]/g, "");
  return t && /\d/.test(t) && /^[\d.,\s\-]+/.test(s.trim()) ? Number(t) : NaN;
};

function enhanceTable(table: HTMLTableElement) {
  if (table.dataset.enh || table.closest(".paper, [data-plain]")) return;
  table.dataset.enh = "1";
  const body = table.tBodies[0];
  if (!body) return;
  const rows = () => Array.from(body.rows);

  // ترتيب
  const heads = table.tHead ? Array.from(table.tHead.rows[0]?.cells ?? []) : [];
  heads.forEach((th, idx) => {
    if (!th.textContent?.trim()) return;
    th.classList.add("sortable");
    th.tabIndex = 0;
    const go = () => {
      const dir = th.dataset.dir === "asc" ? "desc" : "asc";
      heads.forEach((h) => delete h.dataset.dir);
      th.dataset.dir = dir;
      const sorted = rows().sort((a, b) => {
        const x = a.cells[idx]?.textContent?.trim() ?? "", y = b.cells[idx]?.textContent?.trim() ?? "";
        const nx = asNum(x), ny = asNum(y);
        const c = !isNaN(nx) && !isNaN(ny) ? nx - ny : x.localeCompare(y, "ar");
        return dir === "asc" ? c : -c;
      });
      sorted.forEach((r) => body.appendChild(r));
    };
    th.addEventListener("click", go);
    th.addEventListener("keydown", (e) => { if (e.key === "Enter") go(); });
  });

  // بحث للجداول اللي بيها أكثر من 6 صفوف
  if (rows().length <= 6) return;
  const box = table.closest(".tbl") ?? table;
  const wrap = document.createElement("div");
  wrap.className = "tbl-tools noprint";
  const input = document.createElement("input");
  input.type = "search";
  input.placeholder = "بحث بالجدول…";
  input.setAttribute("aria-label", "بحث بالجدول");
  const count = document.createElement("span");
  count.className = "tbl-count";
  const total = rows().length;
  count.textContent = `${total} سجل`;
  wrap.append(input, count);
  box.parentElement?.insertBefore(wrap, box);
  input.addEventListener("input", () => {
    const q = norm(input.value.trim());
    let n = 0;
    for (const r of rows()) {
      const show = !q || norm(r.textContent ?? "").includes(q);
      r.hidden = !show;
      if (show) n++;
    }
    count.textContent = q ? `${n} من ${total}` : `${total} سجل`;
  });
}

export function Enhance() {
  const path = usePathname();
  const sp = useSearchParams();
  useEffect(() => {
    const run = () => document.querySelectorAll<HTMLTableElement>("main table").forEach(enhanceTable);
    run();
    const t = setTimeout(run, 300);
    return () => clearTimeout(t);
  }, [path, sp]);

  useEffect(() => {
    const onSubmit = (e: SubmitEvent) => {
      const b = e.submitter as HTMLElement | null;
      if (!b) return;
      const txt = (b.textContent ?? "").trim();
      const risky = b.classList.contains("danger") || b.getAttribute("aria-label") === "حذف" || txt === "×" || txt.startsWith("حذف") || b.dataset.confirm;
      if (risky && !window.confirm(b.dataset.confirm || "متأكد تريد الحذف؟ ما تگدر ترجعه.")) e.preventDefault();
    };
    document.addEventListener("submit", onSubmit, true);
    return () => document.removeEventListener("submit", onSubmit, true);
  }, []);
  return null;
}
