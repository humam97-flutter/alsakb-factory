// يخلي النظام يفتح بدون إنترنت: آخر نسخة من كل صفحة فتحتها تنحفظ بالجهاز
// الحفظ والتعديل يحتاج إنترنت. عند تسجيل الخروج تنمسح الصفحات المحفوظة
const STATIC = "alsakb-static-v1";
const PAGES = "alsakb-pages-v1";
const SHELL = ["/offline.html", "/icon.svg", "/manifest.webmanifest"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(STATIC).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => ![STATIC, PAGES].includes(k)).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (e) => {
  if (e.data === "clear") caches.delete(PAGES);
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const p = url.pathname;
  if (p.startsWith("/api/") || p.startsWith("/export") || p.includes("/file/") || p.endsWith("/dxf")) return;

  // ملفات الواجهة الثابتة: من الجهاز أولاً
  if (p.startsWith("/_next/static/") || SHELL.includes(p)) {
    e.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) caches.open(STATIC).then((c) => c.put(req, res.clone()));
            return res;
          }),
      ),
    );
    return;
  }

  // الصفحات: من الإنترنت أولاً، وإذا ماكو نرجع آخر نسخة محفوظة
  if (req.mode === "navigate") {
    if (p.startsWith("/login")) caches.delete(PAGES);
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok && !res.redirected && !p.startsWith("/login")) {
            const copy = res.clone();
            caches.open(PAGES).then((c) => c.put(url.pathname + url.search, copy));
          }
          return res;
        })
        .catch(() => caches.open(PAGES).then((c) => c.match(url.pathname + url.search)).then((hit) => hit || caches.match("/offline.html"))),
    );
  }
});
