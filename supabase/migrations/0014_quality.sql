-- المرحلة 4 (أ): اللحامين ومؤهلاتهم، إجراءات اللحام، خريطة اللحامات، الفحوصات، الاختبار المائي، وعدم المطابقة
-- يشغَّل مرة واحدة من SQL Editor بعد 0013

-- مرفقات الجودة تنحفظ ويا ملفات الأمر، مع نوعها والسجل اللي تخصه
alter table order_files add column category text not null default 'general';  -- general, ndt, hydro, ncr, mtc
alter table order_files add column ref_id uuid;
create index order_files_ref on order_files (ref_id) where ref_id is not null;

-- ---------- إجراءات اللحام WPS ----------
create table wps (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,            -- WPS-001
  process text not null default 'SMAW', -- SMAW, GTAW, SAW, FCAW, GMAW
  base_metal text,                       -- P-No.1 Gr.1/2 ...
  thickness_range text,                  -- 5 إلى 40 ملم
  filler text,                           -- E7018، ER70S-6 ...
  positions text,                        -- 1G-6G
  pqr_no text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- مؤهلات اللحامين WPQ ----------
alter table workers add column welder_stamp text;   -- رمز اللحام اللي ينطبع جنب اللحامة

create table welder_quals (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references workers (id) on delete cascade,
  wps_id uuid references wps (id) on delete set null,
  process text not null default 'SMAW',
  positions text,
  thickness_range text,
  cert_no text,
  issued_on date,
  expires_on date,                       -- ASME IX: تنتهي إذا ما لحم بالطريقة 6 أشهر، أو حسب الجهة
  last_used_on date,                     -- آخر استخدام (لتمديد الصلاحية)
  notes text,
  created_at timestamptz not null default now()
);
create index welder_quals_worker on welder_quals (worker_id);

-- ---------- خريطة اللحامات ----------
create table welds (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references work_orders (id) on delete cascade,
  code text not null,                    -- L1، C2، N1 ...
  kind text not null default 'long' check (kind in ('long', 'circ', 'nozzle', 'fillet', 'other')),
  description text,
  wps_id uuid references wps (id) on delete set null,
  welder_id uuid references workers (id) on delete set null,
  welder2_id uuid references workers (id) on delete set null,
  thickness numeric(8, 2),
  length_mm numeric(10, 1),
  ndt text[] not null default '{}',      -- الفحوصات المطلوبة: RT، UT، PT، MT
  done_on date,
  status text not null default 'pending' check (status in ('pending', 'welded', 'accepted', 'repair')),
  notes text,
  created_at timestamptz not null default now(),
  unique (order_id, code)
);
create index welds_order on welds (order_id);

-- ---------- تقارير الفحص غير الإتلافي ----------
create table ndt_reports (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references work_orders (id) on delete cascade,
  method text not null check (method in ('RT', 'UT', 'PT', 'MT', 'VT')),
  report_no text,
  day date not null default current_date,
  agency text,                           -- الجهة الفاحصة
  inspector text,
  extent text,                           -- 100%، 10% نقطي ...
  weld_ids uuid[] not null default '{}',
  result text not null default 'accept' check (result in ('accept', 'reject')),
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) default auth.uid()
);
create index ndt_order on ndt_reports (order_id);

-- ---------- الاختبار المائي ----------
create table hydro_tests (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references work_orders (id) on delete cascade,
  day date not null default current_date,
  design_bar numeric(8, 2),
  test_bar numeric(8, 2) not null,
  hold_min int not null default 30,
  medium text not null default 'ماي',
  temp_c numeric(5, 1),
  gauge_no text,
  gauge_cal_due date,
  witness text,                          -- ممثل الزبون أو المفتش
  result text not null default 'pass' check (result in ('pass', 'fail')),
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) default auth.uid()
);
create index hydro_order on hydro_tests (order_id);

-- ---------- عدم المطابقة NCR ----------
create sequence ncr_no start 1;
create table ncrs (
  id uuid primary key default gen_random_uuid(),
  no int not null unique default nextval('ncr_no'),
  order_id uuid references work_orders (id) on delete set null,
  day date not null default current_date,
  source text not null default 'internal' check (source in ('internal', 'customer', 'supplier')),
  description text not null,
  cause text,
  action text,                           -- الإجراء التصحيحي
  cost numeric(14, 2) not null default 0,
  status text not null default 'open' check (status in ('open', 'closed')),
  closed_on date,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) default auth.uid()
);
create index ncrs_order on ncrs (order_id);

-- ---------- الصلاحيات: القراءة للكل، الكتابة للمدير والإنتاج ----------
do $$
declare t text;
begin
  foreach t in array array['wps', 'welder_quals', 'welds', 'ndt_reports', 'hydro_tests', 'ncrs']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy %I_read on %I for select using (current_role_name() is not null)', t, t);
    execute format($p$create policy %I_write on %I for all using (has_role('manager', 'production')) with check (has_role('manager', 'production'))$p$, t, t);
    execute format('grant select, insert, update, delete on %I to authenticated', t);
    execute format('create trigger %I_audit after insert or update or delete on %I for each row execute function audit()', t, t);
  end loop;
end $$;
grant usage, select on sequence ncr_no to authenticated;
