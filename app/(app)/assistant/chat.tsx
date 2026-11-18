"use client";

import { useEffect, useRef, useState } from "react";

type Turn = { role: "user" | "assistant"; text: string };
const KEY = "alsakb-chat";

// نص الجواب: فقرات ونقاط، والنص بين ** يصير عريض
function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split("\n").map((line, i) => {
        const parts = line.split(/\*\*(.+?)\*\*/g).map((p, j) => (j % 2 ? <b key={j}>{p}</b> : p));
        const bullet = /^\s*[-•*]\s+/.test(line);
        if (!line.trim()) return <div key={i} style={{ height: 6 }} />;
        return bullet ? (
          <div key={i} style={{ paddingInlineStart: 14, position: "relative" }}>
            <span aria-hidden="true" style={{ position: "absolute", insetInlineStart: 2 }}>•</span>
            {line.split(/\*\*(.+?)\*\*/g).map((p, j) => (j % 2 ? <b key={j}>{p}</b> : p.replace(/^\s*[-•*]\s+/, "")))}
          </div>
        ) : (
          <div key={i}>{/^#+\s/.test(line) ? <b>{line.replace(/^#+\s/, "")}</b> : parts}</div>
        );
      })}
    </>
  );
}

export function Chat({ ideas, disabled }: { ideas: string[]; disabled?: boolean }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const s = sessionStorage.getItem(KEY);
      if (s) setTurns(JSON.parse(s));
    } catch {}
  }, []);
  useEffect(() => {
    try {
      if (!busy) sessionStorage.setItem(KEY, JSON.stringify(turns));
    } catch {}
    end.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [turns, busy]);

  async function ask(text: string) {
    const t = text.trim();
    if (!t || busy) return;
    const next: Turn[] = [...turns, { role: "user", text: t }];
    setTurns([...next, { role: "assistant", text: "" }]);
    setQ("");
    setBusy(true);
    try {
      const res = await fetch("/api/ai/ask", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ turns: next }) });
      if (!res.body) throw new Error(await res.text());
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += dec.decode(value, { stream: true });
        setTurns([...next, { role: "assistant", text: acc }]);
      }
      if (!acc.trim()) setTurns([...next, { role: "assistant", text: "⚠ ما وصل جواب. جرّب مرة ثانية." }]);
    } catch (e) {
      setTurns([...next, { role: "assistant", text: `⚠ ${e instanceof Error && e.message ? e.message : "انقطع الاتصال. تأكد من الإنترنت."}` }]);
    }
    setBusy(false);
  }

  return (
    <div className="chat">
      <div className="chat-log" aria-live="polite">
        {!turns.length && (
          <div className="chat-empty">
            <b>اسألني عن أي شي بالمعمل</b>
            <span className="meta">أوامر العمل، المخزن، الألواح، المكائن، الحضور{ideas.length > 4 ? "، الديون والمشاريع" : ""}.</span>
            <div className="chat-ideas">
              {ideas.map((x) => (
                <button key={x} type="button" className="btn ghost sm" onClick={() => ask(x)} disabled={disabled}>{x}</button>
              ))}
            </div>
          </div>
        )}
        {turns.map((t, i) => (
          <div key={i} className={`chat-msg ${t.role}`}>
            {t.role === "assistant" && !t.text ? <span className="chat-dots" aria-label="يفكر"><i /><i /><i /></span> : t.role === "assistant" ? <Rich text={t.text} /> : t.text}
          </div>
        ))}
        <div ref={end} />
      </div>
      <form
        className="chat-box"
        onSubmit={(e) => {
          e.preventDefault();
          ask(q);
        }}
      >
        <textarea
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              ask(q);
            }
          }}
          placeholder="اكتب سؤالك..."
          rows={1}
          disabled={disabled}
          aria-label="السؤال"
        />
        <button className="btn" type="submit" disabled={disabled || busy || !q.trim()}>{busy ? "..." : "إرسال"}</button>
        {turns.length > 0 && !busy && (
          <button className="btn ghost" type="button" onClick={() => setTurns([])}>محادثة جديدة</button>
        )}
      </form>
    </div>
  );
}
