"use client";

import { useEffect, useState } from "react";

// رسالة النجاح تطلع تحت وتختفي لحالها
export function Toast({ msg }: { msg: string }) {
  const [show, setShow] = useState(true);
  useEffect(() => {
    setShow(true);
    const t = setTimeout(() => setShow(false), 4500);
    return () => clearTimeout(t);
  }, [msg]);
  if (!show) return null;
  return (
    <div className="toast" role="status" onClick={() => setShow(false)}>
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" /></svg>
      {msg}
    </div>
  );
}
