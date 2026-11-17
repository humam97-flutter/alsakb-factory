-- المرحلة 4 (ب): خطة الفحص ITP، تتبع المواد لرقم الصبة، ولوحة الاسم للـ Data Book
-- يشغَّل مرة واحدة من SQL Editor بعد 0014

-- ---------- خطة الفحص والاختبار ITP لكل أمر ----------
create table itp_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references work_orders (id) on delete cascade,
  seq int not null default 1,
  activity text not null,                -- النشاط: استلام المواد، التجميع قبل اللحام ...
  reference text,                         -- المرجع: ASME VIII، WPS، الرسم ...
  acceptance text,                        -- معيار القبول
  record text,                            -- السجل الناتج: MTC، تقرير RT ...
  factory text check (factory in ('H', 'W', 'R', 'M')),   -- H نقطة توقف، W شهادة، R مراجعة، M مراقبة
  client text check (client in ('H', 'W', 'R', 'M')),
  tpi text check (tpi in ('H', 'W', 'R', 'M')),            -- جهة التفتيش الثالثة
  status text not null default 'pending' check (status in ('pending', 'done', 'na')),
  done_on date,
  done_by text,
  notes text,
  created_at timestamptz not null default now()
);
create index itp_items_order on itp_items (order_id, seq);

-- ---------- شهادات المواد اليدوية (أنابيب، فلنجات، رؤوس مشتراة ...) ----------
-- الألواح المقصوصة تنتتبع تلقائياً من مخططات القص ورقم صبة اللوح
create table material_certs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references work_orders (id) on delete cascade,
  item text not null,                     -- الوصف: فلنج 4" 150#، أنبوب 6" Sch40 ...
  grade text,
  size text,
  qty numeric(10, 2),
  heat_no text,
  cert_no text,
  supplier text,
  notes text,
  created_at timestamptz not null default now()
);
create index material_certs_order on material_certs (order_id);

-- ---------- لوحة الاسم ومعلومات التصميم للأمر ----------
alter table work_orders add column nameplate jsonb not null default '{}';

-- ---------- الصلاحيات: القراءة للكل، الكتابة للمدير والإنتاج ----------
alter table itp_items enable row level security;
alter table material_certs enable row level security;
create policy itp_items_read on itp_items for select using (current_role_name() is not null);
create policy itp_items_write on itp_items for all using (has_role('manager', 'production')) with check (has_role('manager', 'production'));
create policy material_certs_read on material_certs for select using (current_role_name() is not null);
create policy material_certs_write on material_certs for all using (has_role('manager', 'production')) with check (has_role('manager', 'production'));
grant select, insert, update, delete on itp_items, material_certs to authenticated;
create trigger itp_items_audit after insert or update or delete on itp_items for each row execute function audit();
create trigger material_certs_audit after insert or update or delete on material_certs for each row execute function audit();
