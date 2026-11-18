-- مخططات التصميم (DXF): القطع، الترتيب على الألواح، الكلفة والوقت، وربطها بالتسعيرة وأمر العمل

-- ---------- أسعار القص (السرعات وكلفة ساعة الماكنة) ----------
alter table settings add column cut_rates jsonb not null default '{}';

-- ---------- المخططات ----------
create sequence drawing_no start 1;
create table drawings (
  id uuid primary key default gen_random_uuid(),
  no int not null unique default nextval('drawing_no'),
  title text not null,
  file_name text,
  customer_id uuid references customers (id) on delete set null,
  job_type text not null default 'cut_only' check (job_type in ('cut_only', 'structure', 'tank', 'vessel', 'other')),
  grade text not null default 'A36',
  sets int not null default 1 check (sets > 0),           -- كم نسخة من المخطط
  parts jsonb not null default '[]',                      -- القطع مع أشكالها
  summary jsonb not null default '{}',                    -- الألواح والهدر والكلفة والوقت وقت الحساب
  estimate_id uuid references estimates (id) on delete set null,
  order_id uuid references work_orders (id) on delete set null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) default auth.uid()
);
create index drawings_order on drawings (order_id);

-- ---------- القطع بأشكال حرة من المخطط ----------
alter table cut_parts add column geometry jsonb;              -- {outer, holes} بالملم، الأصل زاوية المستطيل المحيط
alter table cut_parts add column area_mm2 numeric(14, 1);     -- المساحة الحقيقية بعد الفتحات
alter table cut_parts add column cut_len_mm numeric(14, 1);   -- طول القص للقطعة الوحدة
alter table cut_parts add column pierces int;                 -- عدد الثقوب (بداية كل قص)
alter table cut_parts add column drawing_id uuid references drawings (id) on delete set null;

-- ---------- الصلاحيات ----------
alter table drawings enable row level security;
create policy drawings_read on drawings for select using (has_role('manager', 'production', 'accountant'));
create policy drawings_write on drawings for all
  using (has_role('manager', 'production', 'accountant')) with check (has_role('manager', 'production', 'accountant'));
grant select, insert, update, delete on drawings to authenticated;
grant usage on sequence drawing_no to authenticated;

create trigger drawings_audit after insert or update or delete on drawings for each row execute function audit();
