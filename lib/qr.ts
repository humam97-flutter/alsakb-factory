import { headers } from "next/headers";
import QRCode from "qrcode";

// رابط كامل لصفحة داخل النظام، من عنوان الطلب الحالي
export async function siteUrl(path: string) {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}${path}`;
}

export function qrSvg(text: string) {
  return QRCode.toString(text, { type: "svg", margin: 0, errorCorrectionLevel: "M" });
}
