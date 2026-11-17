-- هوية المعمل: الشعار وبيانات الترويسة الرسمية
-- يشغَّل مرة واحدة من SQL Editor بعد 0009

alter table settings add column logo_path text;          -- مسار الشعار بحاوية branding
alter table settings add column email text;
alter table settings add column reg_no text;             -- رقم التسجيل أو الإجازة
alter table settings add column manager_name text;       -- يطلع بالتوقيع أسفل المطبوعات

-- حاوية عامة للشعار فقط (الصورة تنقرى بدون دخول حتى تطلع بصفحة الدخول)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('branding', 'branding', true, 2097152, array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'])
on conflict (id) do nothing;

create policy branding_read on storage.objects for select
  using (bucket_id = 'branding');
create policy branding_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'branding' and public.has_role('manager'));
create policy branding_delete on storage.objects for delete to authenticated
  using (bucket_id = 'branding' and public.has_role('manager'));
