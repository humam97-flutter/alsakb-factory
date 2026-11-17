-- الدفعة الأولى: سجل التعديلات، ومرفقات أوامر العمل
-- يشغَّل مرة واحدة من SQL Editor بعد 0003

-- ---------- سجل التعديلات ----------
create table audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  user_id uuid default auth.uid(),
  table_name text not null,
  row_id uuid,
  action text not null check (action in ('insert', 'update', 'delete')),
  changes jsonb not null   -- للتعديل: {الحقل: [القديم, الجديد]}؛ للإضافة والحذف: السجل كامل
);
create index audit_log_at on audit_log (at desc);
create index audit_log_row on audit_log (row_id);

create function audit() returns trigger language plpgsql security definer set search_path = public as $$
declare
  o jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  n jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  r jsonb := coalesce(n, o);
  diff jsonb := '{}';
  k text;
begin
  if tg_op = 'UPDATE' then
    for k in select jsonb_object_keys(n) loop
      if k not in ('updated_at', 'updated_by') and (o -> k) is distinct from (n -> k) then
        diff := diff || jsonb_build_object(k, jsonb_build_array(o -> k, n -> k));
      end if;
    end loop;
    if diff = '{}' then return null; end if;
  end if;
  insert into audit_log (table_name, row_id, action, changes)
  values (tg_table_name,
          coalesce(r ->> 'id', r ->> 'order_id', r ->> 'worker_id')::uuid,
          lower(tg_op),
          case tg_op when 'UPDATE' then diff else r end);
  return null;
end $$;

do $$
declare t text;
begin
  foreach t in array array['work_orders', 'work_order_finance', 'materials', 'stock_moves', 'workers', 'worker_wages',
                           'worker_payments', 'machines', 'maintenance', 'documents', 'profiles']
  loop
    execute format('create trigger %I_audit after insert or update or delete on %I for each row execute function audit()', t, t);
  end loop;
end $$;

alter table audit_log enable row level security;
create policy audit_read on audit_log for select using (has_role('manager'));
grant select on audit_log to authenticated;

-- ---------- مرفقات أوامر العمل (رسومات، صور) ----------
create table order_files (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references work_orders (id) on delete cascade,
  path text not null unique,
  name text not null,
  size bigint,
  mime text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) default auth.uid()
);
create index order_files_order on order_files (order_id);
alter table order_files enable row level security;
-- الكل يشوف الرسومات (العامل يحتاجها)، والإضافة والحذف لمدير الإنتاج والمدير
create policy order_files_read on order_files for select using (current_role_name() is not null);
create policy order_files_write on order_files for all
  using (has_role('manager', 'production')) with check (has_role('manager', 'production'));
grant select, insert, update, delete on order_files to authenticated;

insert into storage.buckets (id, name, public, file_size_limit)
values ('orders', 'orders', false, 52428800)
on conflict (id) do nothing;

create policy orders_bucket_read on storage.objects for select to authenticated
  using (bucket_id = 'orders' and public.current_role_name() is not null);
create policy orders_bucket_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'orders' and public.has_role('manager', 'production'));
create policy orders_bucket_delete on storage.objects for delete to authenticated
  using (bucket_id = 'orders' and public.has_role('manager', 'production'));
