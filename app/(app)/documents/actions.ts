"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { dbError, fail, numOrNull, str } from "@/lib/form";
import { supabase } from "@/lib/supabase/server";

const BUCKET = "documents";

export async function saveDocument(form: FormData) {
  const db = await supabase();
  const id = str(form, "id");
  const back = id ? `/documents/${id}/edit` : "/documents/new";
  const subject = str(form, "subject");
  const kind = str(form, "kind");
  if (!subject || !kind) fail(back, "اختر النوع واكتب الموضوع.");
  const row = {
    kind,
    ref_no: str(form, "ref_no"),
    doc_date: str(form, "doc_date") ?? undefined,
    subject,
    party: str(form, "party"),
    summary: str(form, "summary"),
    status: str(form, "status") ?? "pending",
    due_date: str(form, "due_date"),
    starts_on: str(form, "starts_on"),
    expires_on: str(form, "expires_on"),
    amount: numOrNull(form, "amount"),
    currency: str(form, "currency") ?? "IQD",
    reply_to: str(form, "reply_to"),
    order_id: str(form, "order_id"),
  };
  const res = id
    ? await db.from("documents").update(row).eq("id", id).select("id").single()
    : await db.from("documents").insert(row).select("id").single();
  if (res.error) fail(back, dbError(res.error));
  // الرد على كتاب وارد يخلّيه «منجز»
  if (!id && row.reply_to) await db.from("documents").update({ status: "done" }).eq("id", row.reply_to).eq("status", "pending");
  revalidatePath("/documents");
  redirect(`/documents/${res.data.id}${id ? "" : "?ok=" + encodeURIComponent("انحفظ. هسه ارفع صورة الكتاب أو ملفه.")}`);
}

export async function deleteDocument(form: FormData) {
  const db = await supabase();
  const id = str(form, "id")!;
  if (str(form, "confirm") !== "yes") fail(`/documents/${id}/edit`, "أشّر على التأكيد قبل الحذف.");
  const { data: files } = await db.from("document_files").select("path").eq("document_id", id);
  if (files?.length) await db.storage.from(BUCKET).remove(files.map((f) => f.path));
  const { error } = await db.from("documents").delete().eq("id", id);
  if (error) fail(`/documents/${id}/edit`, dbError(error));
  revalidatePath("/documents");
  redirect("/documents");
}

export async function setDocumentStatus(form: FormData) {
  const db = await supabase();
  const id = str(form, "id")!;
  const { error } = await db.from("documents").update({ status: str(form, "status") }).eq("id", id);
  if (error) fail(`/documents/${id}`, dbError(error));
  revalidatePath(`/documents/${id}`);
  revalidatePath("/documents");
}

// يُستدعى من المتصفح بعد ما يرفع الملفات مباشرة إلى التخزين
export async function addFiles(documentId: string, files: { path: string; name: string; size: number; mime: string }[]) {
  const db = await supabase();
  const { error } = await db
    .from("document_files")
    .insert(files.map((f) => ({ document_id: documentId, path: f.path, name: f.name, size: f.size, mime: f.mime || null })));
  if (error) {
    await db.storage.from(BUCKET).remove(files.map((f) => f.path));
    return { error: dbError(error) };
  }
  revalidatePath(`/documents/${documentId}`);
  revalidatePath("/documents");
  return { error: null };
}

export async function deleteFile(form: FormData) {
  const db = await supabase();
  const id = str(form, "id")!;
  const documentId = str(form, "document_id")!;
  const { data: f } = await db.from("document_files").select("path").eq("id", id).maybeSingle();
  if (f) {
    const { error: se } = await db.storage.from(BUCKET).remove([f.path]);
    if (se) fail(`/documents/${documentId}`, "تعذر حذف الملف: " + se.message);
    const { error } = await db.from("document_files").delete().eq("id", id);
    if (error) fail(`/documents/${documentId}`, dbError(error));
  }
  revalidatePath(`/documents/${documentId}`);
}
