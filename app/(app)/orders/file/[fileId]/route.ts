import { NextResponse, type NextRequest } from "next/server";
import { supabase } from "@/lib/supabase/server";

// يفتح الملف برابط مؤقت (دقيقتين)؛ ?download=1 للتنزيل
export async function GET(request: NextRequest, { params }: { params: Promise<{ fileId: string }> }) {
  const { fileId } = await params;
  const db = await supabase();
  const { data: f } = await db.from("order_files").select("path, name").eq("id", fileId).maybeSingle();
  if (!f) return new NextResponse("الملف غير موجود أو ليس لديك صلاحية.", { status: 404 });
  const download = request.nextUrl.searchParams.has("download");
  const { data, error } = await db.storage.from("orders").createSignedUrl(f.path, 120, download ? { download: f.name } : undefined);
  if (error || !data) return new NextResponse("تعذر فتح الملف.", { status: 500 });
  return NextResponse.redirect(data.signedUrl);
}
