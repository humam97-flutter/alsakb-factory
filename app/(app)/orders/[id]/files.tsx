import { Upload } from "@/components/upload";
import { fileSize } from "@/lib/labels";
import { supabase } from "@/lib/supabase/server";
import { addOrderFiles, deleteOrderFile } from "../actions";

// الرسومات وصور الشغل: الصور تطلع مصغرة، والباقي روابط
export async function OrderFiles({ orderId, canEdit }: { orderId: string; canEdit: boolean }) {
  const db = await supabase();
  const { data: files } = await db.from("order_files").select("*").eq("order_id", orderId).eq("category", "general").order("created_at");
  const images = (files ?? []).filter((f) => f.mime?.startsWith("image/"));
  const signed = images.length
    ? (await db.storage.from("orders").createSignedUrls(images.map((f) => f.path), 3600)).data ?? []
    : [];
  const thumb = new Map(signed.map((s) => [s.path, s.signedUrl]));
  if (!canEdit && !files?.length) return null;
  return (
    <>
      <h3 className="sec">الرسومات والصور</h3>
      <div className="panel">
        {canEdit && <Upload bucket="orders" folder={orderId} save={addOrderFiles.bind(null, orderId)} />}
        {images.length > 0 && (
          <div className="thumbs">
            {images.map((f) => (
              <a key={f.id} href={`/orders/file/${f.id}`} target="_blank" rel="noopener" title={f.name}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={thumb.get(f.path) ?? ""} alt={f.name} loading="lazy" />
              </a>
            ))}
          </div>
        )}
        {files?.length ? (
          <ul className="stages" style={{ marginTop: 10 }}>
            {files.map((f) => (
              <li key={f.id}>
                <a className="name" href={`/orders/file/${f.id}`} target="_blank" rel="noopener">{f.name}</a>
                <span className="meta num">{fileSize(f.size)}</span>
                <a className="btn ghost sm" href={`/orders/file/${f.id}?download=1`}>تنزيل</a>
                {canEdit && (
                  <form action={deleteOrderFile}>
                    <input type="hidden" name="id" value={f.id} />
                    <input type="hidden" name="order_id" value={orderId} />
                    <button className="btn ghost sm" type="submit" aria-label={`حذف ${f.name}`}>×</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="meta" style={{ marginBottom: 0 }}>ارفع رسم الشغل (PDF أو DWG) أو صور، حتى العامل يشوفها من موبايله.</p>
        )}
      </div>
    </>
  );
}
