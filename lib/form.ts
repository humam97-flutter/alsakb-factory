import { redirect } from "next/navigation";

// قراءة حقول النماذج
export const str = (f: FormData, k: string) => {
  const v = String(f.get(k) ?? "").trim();
  return v === "" ? null : v;
};
export const numOrNull = (f: FormData, k: string) => {
  const v = str(f, k);
  return v === null ? null : Number(v);
};
export const numOr0 = (f: FormData, k: string) => numOrNull(f, k) ?? 0;
export const list = (f: FormData, k: string) => f.getAll(k).map(String).filter(Boolean);

// يرجع للصفحة مع رسالة خطأ تظهر أعلاها
export function fail(path: string, message: string): never {
  redirect(`${path}${path.includes("?") ? "&" : "?"}error=${encodeURIComponent(message)}`);
}

export function dbError(e: { message: string; code?: string }) {
  if (e.code === "42501" || /row-level security/.test(e.message)) return "ليس لديك صلاحية لهذا التعديل.";
  if (e.code === "23505") return "هذه القيمة مسجلة من قبل.";
  if (e.code === "23503") return "لا يمكن الحذف لأن هناك سجلات مرتبطة به.";
  return "تعذر الحفظ: " + e.message;
}
