"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

// تسجيل الـ service worker، وشريط ينبّه إذا انقطع الإنترنت
export function Pwa() {
  const [online, setOnline] = useState(true);
  const path = usePathname();
  // صفحة الدخول تعني خروج أو جهاز جديد: نمسح الصفحات المحفوظة حتى ما يشوفها غيرك
  useEffect(() => {
    if (path.startsWith("/login")) navigator.serviceWorker?.controller?.postMessage("clear");
  }, [path]);
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") navigator.serviceWorker.register("/sw.js").catch(() => {});
    const up = () => setOnline(navigator.onLine);
    up();
    window.addEventListener("online", up);
    window.addEventListener("offline", up);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", up);
    };
  }, []);
  if (online) return null;
  return (
    <div className="offline-bar" role="status">
      ماكو إنترنت: تشوف آخر نسخة محفوظة من الصفحات. الحفظ والتعديل يرجع أول ما يرجع الخط.
    </div>
  );
}
