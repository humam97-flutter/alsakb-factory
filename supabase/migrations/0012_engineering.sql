-- المرحلة 2: حفظ الحسابات الهندسية (وعاء ضغط، خزان) وربطها بأمر العمل
-- يشغَّل مرة واحدة من SQL Editor بعد 0011

create table calcs (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('vessel', 'tank', 'dip', 'weld')),
  title text not null,
  order_id uuid references work_orders (id) on delete set null,
  inputs jsonb not null default '{}',   -- مدخلات الحاسبة كما هي (تنفتح منها مرة ثانية)
  results jsonb not null default '{}',  -- ملخص النتائج وقت الحفظ
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) default auth.uid()
);
create index calcs_order on calcs (order_id);
create index calcs_created on calcs (created_at desc);

alter table calcs enable row level security;
create policy calcs_read on calcs for select using (current_role_name() is not null);
create policy calcs_write on calcs for all using (has_role('manager', 'production')) with check (has_role('manager', 'production'));
grant select, insert, update, delete on calcs to authenticated;

create trigger calcs_audit after insert or update or delete on calcs for each row execute function audit();
