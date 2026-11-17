"use client";

import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { addFiles } from "../actions";

// الملف يترفع من المتصفح مباشرة إلى Supabase، فما يتقيد بحد حجم الطلبات بـ Vercel
export function Upload({ documentId }: { documentId: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const list = Array.from(e.target.files ?? []);
    if (!list.length) return;
    setError("");
    const db = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const done: { path: string; name: string; size: number; mime: string }[] = [];
    for (const [i, f] of list.entries()) {
      if (f.size > 50 * 1024 * 1024) {
        setError(`الملف ${f.name} أكبر من 50 ميغا.`);
        continue;
      }
      setBusy(`جاري رفع ${i + 1} من ${list.length}: ${f.name}`);
      const ext = (f.name.split(".").pop() ?? "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8);
      const path = `${documentId}/${crypto.randomUUID()}${ext ? "." + ext : ""}`;
      const { error } = await db.storage.from("documents").upload(path, f, { contentType: f.type || undefined });
      if (error) {
        setError(`تعذر رفع ${f.name}: ${error.message}`);
        continue;
      }
      done.push({ path, name: f.name, size: f.size, mime: f.type });
    }
    if (done.length) {
      setBusy("جاري الحفظ…");
      const res = await addFiles(documentId, done);
      if (res.error) setError(res.error);
    }
    setBusy("");
    if (input.current) input.current.value = "";
    router.refresh();
  }

  return (
    <div className="row">
      <label className="btn" style={{ cursor: busy ? "wait" : "pointer" }}>
        + رفع ملف أو صورة
        <input
          ref={input}
          type="file"
          multiple
          accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx"
          onChange={onChange}
          disabled={!!busy}
          style={{ display: "none" }}
        />
      </label>
      <label className="btn ghost" style={{ cursor: busy ? "wait" : "pointer" }}>
        تصوير بالكاميرا
        <input type="file" accept="image/*" capture="environment" onChange={onChange} disabled={!!busy} style={{ display: "none" }} />
      </label>
      {busy && <span className="meta" role="status">{busy}</span>}
      {error && <span className="tone-bad" role="alert" style={{ fontSize: 13 }}>{error}</span>}
    </div>
  );
}
