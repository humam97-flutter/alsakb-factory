// رابط الموقع: الدومين الخاص إذا انضاف (NEXT_PUBLIC_SITE_URL)، وإلا رابط Vercel
export function siteUrl() {
  const u = process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "");
  return u.replace(/\/$/, "");
}
