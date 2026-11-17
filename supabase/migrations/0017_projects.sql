-- المرحلة 6: المشاريع والدفعات: مشروع يجمع أوامر، دفعات حسب الإنجاز، المحتجزات، خطابات الضمان، والمناقصات
-- يشغَّل مرة واحدة من SQL Editor بعد 0016

-- ---------- المشاريع ----------
create sequence project_no start 1;

create table projects (
  id uuid primary key default gen_random_uuid(),
  no int not null unique default nextval('project_no'),
  name text not null,
  customer_id uuid references customers (id) on delete set null,
  contract_no text,
  contract_value numeric(16, 2) not null default 0,
  currency text not null default 'IQD' check (currency in ('IQD', 'USD')),
  start_date date,
  end_date date,
  status text not null default 'active' check (status in ('active', 'hold', 'done', 'cancelled')),
  retention_pct numeric(5, 2) not null default 5,    -- المحتجز من كل دفعة لحد الاستلام النهائي
  advance_pct numeric(5, 2) not null default 0,      -- السلفة المقدمة، تُسترد من الدفعات بنفس النسبة
  manager text,
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) default auth.uid()
);

alter table work_orders add column project_id uuid references projects (id) on delete set null;
create index work_orders_project on work_orders (project_id) where project_id is not null;
alter table invoices add column project_id uuid references projects (id) on delete set null;
create index invoices_project on invoices (project_id) where project_id is not null;

-- ---------- دفعات المشروع حسب الإنجاز ----------
create table project_milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  position int not null default 1,
  name text not null,
  kind text not null default 'progress' check (kind in ('advance', 'progress', 'delivery', 'retention')),
  pct numeric(6, 2) not null default 0,                -- نسبة من قيمة العقد
  order_id uuid references work_orders (id) on delete set null,   -- إذا الدفعة مربوطة بإنجاز أمر
  trigger_progress smallint check (trigger_progress between 0 and 100),  -- تستحق لما يوصل الأمر هالنسبة بالوزن
  due_date date,
  status text not null default 'pending' check (status in ('pending', 'invoiced', 'paid')),
  invoice_id uuid references invoices (id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);
create index project_milestones_project on project_milestones (project_id, position);

-- ---------- خطابات الضمان ----------
create table guarantees (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects (id) on delete set null,
  tender_id uuid,
  customer_id uuid references customers (id) on delete set null,
  kind text not null default 'performance' check (kind in ('bid', 'performance', 'advance', 'retention', 'warranty')),
  bank text,
  ref_no text,
  amount numeric(16, 2) not null default 0,
  currency text not null default 'IQD' check (currency in ('IQD', 'USD')),
  issued_on date,
  expires_on date,
  fee numeric(16, 2) not null default 0,              -- عمولة المصرف
  cash_margin numeric(16, 2) not null default 0,      -- التأمينات النقدية المحجوزة بالمصرف
  status text not null default 'active' check (status in ('active', 'released', 'claimed')),
  notes text,
  created_at timestamptz not null default now()
);

-- ---------- المناقصات ----------
create sequence tender_no start 1;

create table tenders (
  id uuid primary key default gen_random_uuid(),
  no int not null unique default nextval('tender_no'),
  title text not null,
  customer_id uuid references customers (id) on delete set null,
  issuer text,                                          -- الجهة المعلنة
  ref_no text,
  published_on date,
  submit_due date,
  bid_bond numeric(16, 2) not null default 0,
  doc_fee numeric(16, 2) not null default 0,            -- ثمن الأوراق
  estimate_id uuid references estimates (id) on delete set null,
  our_price numeric(16, 2),
  currency text not null default 'IQD' check (currency in ('IQD', 'USD')),
  status text not null default 'preparing' check (status in ('preparing', 'submitted', 'won', 'lost', 'cancelled')),
  winner text,
  winner_price numeric(16, 2),
  project_id uuid references projects (id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) default auth.uid()
);
alter table guarantees add constraint guarantees_tender foreign key (tender_id) references tenders (id) on delete set null;

-- ---------- الصلاحيات: المالية للمدير والمحاسب، والمشاريع يقرأها الإنتاج ----------
alter table projects enable row level security;
alter table project_milestones enable row level security;
alter table guarantees enable row level security;
alter table tenders enable row level security;
create policy projects_read on projects for select using (has_role('manager', 'accountant', 'production'));
create policy projects_write on projects for all using (has_role('manager', 'accountant')) with check (has_role('manager', 'accountant'));
create policy project_milestones_all on project_milestones for all using (has_role('manager', 'accountant')) with check (has_role('manager', 'accountant'));
create policy guarantees_all on guarantees for all using (has_role('manager', 'accountant')) with check (has_role('manager', 'accountant'));
create policy tenders_all on tenders for all using (has_role('manager', 'accountant')) with check (has_role('manager', 'accountant'));
grant select, insert, update, delete on projects, project_milestones, guarantees, tenders to authenticated;
grant usage, select on sequence project_no, tender_no to authenticated;
create trigger projects_audit after insert or update or delete on projects for each row execute function audit();
create trigger project_milestones_audit after insert or update or delete on project_milestones for each row execute function audit();
create trigger guarantees_audit after insert or update or delete on guarantees for each row execute function audit();
create trigger tenders_audit after insert or update or delete on tenders for each row execute function audit();
