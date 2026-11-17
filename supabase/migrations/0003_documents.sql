-- قسم المستندات: الكتب الواردة والصادرة، العقود، المستندات الرسمية، مع مرفقاتها
-- يشغَّل مرة واحدة من SQL Editor بعد 0001 و 0002

create type doc_kind as enum ('incoming', 'outgoing', 'contract', 'official', 'other');
create type doc_status as enum ('pending', 'done', 'archived');

create table documents (
  id uuid primary key default gen_random_uuid(),
  kind doc_kind not null,
  serial int,                 -- تسلسل داخلي لكل نوع بكل سنة
  ref_no text,                -- رقم الكتاب أو العقد؛ إذا انترك فارغ ينحط تلقائياً (ص/2026/1)
  doc_date date not null default current_date,
  subject text not null,      -- الموضوع
  party text,                 -- الجهة: المرسِل أو المرسَل إليه أو الطرف الثاني
  summary text,
  status doc_status not null default 'pending',
  due_date date,              -- موعد الرد أو الإجراء
  starts_on date,             -- للعقود والمستندات الرسمية
  expires_on date,
  amount numeric(16, 2),
  currency text not null default 'IQD' check (currency in ('IQD', 'USD')),
  reply_to uuid references documents (id) on delete set null,
  order_id uuid references work_orders (id) on delete set null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) default auth.uid(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id)
);
create index documents_kind_date on documents (kind, doc_date desc);
create index documents_expires on documents (expires_on) where expires_on is not null;

create table document_files (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents (id) on delete cascade,
  path text not null unique,  -- المسار داخل حاوية التخزين documents
  name text not null,         -- اسم الملف الأصلي
  size bigint,
  mime text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) default auth.uid()
);
create index document_files_doc on document_files (document_id);

-- رقم تلقائي: و (وارد)، ص (صادر)، ع (عقد)، م (رسمي أو غيره)
create function document_number() returns trigger language plpgsql as $$
declare y int := extract(year from new.doc_date);
begin
  if new.serial is null then
    perform pg_advisory_xact_lock(hashtext('documents:' || new.kind || ':' || y));
    select coalesce(max(serial), 0) + 1 into new.serial
      from documents where kind = new.kind and extract(year from doc_date) = y;
  end if;
  if new.ref_no is null or btrim(new.ref_no) = '' then
    new.ref_no := (case new.kind when 'incoming' then 'و' when 'outgoing' then 'ص' when 'contract' then 'ع' else 'م' end)
                  || '/' || y || '/' || new.serial;
  end if;
  return new;
end $$;
create trigger documents_number before insert on documents for each row execute function document_number();
create trigger documents_touch before update on documents for each row execute function touch_updated();

-- الصلاحيات: المدير والمحاسب
alter table documents enable row level security;
alter table document_files enable row level security;
create policy documents_all on documents for all
  using (has_role('manager', 'accountant')) with check (has_role('manager', 'accountant'));
create policy document_files_all on document_files for all
  using (has_role('manager', 'accountant')) with check (has_role('manager', 'accountant'));

grant select, insert, update, delete on documents, document_files to authenticated;

-- حاوية الملفات (خاصة، الحد 50 ميغا للملف)
insert into storage.buckets (id, name, public, file_size_limit)
values ('documents', 'documents', false, 52428800)
on conflict (id) do nothing;

create policy documents_bucket_read on storage.objects for select to authenticated
  using (bucket_id = 'documents' and public.has_role('manager', 'accountant'));
create policy documents_bucket_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and public.has_role('manager', 'accountant'));
create policy documents_bucket_delete on storage.objects for delete to authenticated
  using (bucket_id = 'documents' and public.has_role('manager', 'accountant'));
