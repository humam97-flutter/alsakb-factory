-- معمل السكب الحديدي: المرحلة الأولى
-- الأدوار، المكائن، العمال، المخزن، أوامر العمل، الحضور، الرواتب، الصيانة

create extension if not exists pgcrypto;

-- ---------- الأدوار ----------
create type app_role as enum ('manager', 'production', 'storekeeper', 'accountant', 'operator');

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  phone text not null unique,
  role app_role not null default 'operator',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- دور المستخدم الحالي، أو null إذا غير مسجل أو موقوف
create function current_role_name() returns app_role
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid() and active
$$;

create function has_role(variadic roles app_role[]) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(current_role_name() = any (roles), false)
$$;

-- ---------- عامة ----------
create function touch_updated() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end $$;

-- ---------- المكائن ----------
create type machine_status as enum ('running', 'idle', 'maintenance', 'broken');

create table machines (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  capacity text,
  status machine_status not null default 'running',
  next_service date,
  notes text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id)
);

-- ---------- العمال ----------
create table workers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  job text,
  phone text,
  skills uuid[] not null default '{}',
  active boolean not null default true,
  notes text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id)
);

alter table machines add column operator_id uuid references workers (id) on delete set null;

-- الأجور منفصلة حتى لا يراها غير المدير والمحاسب
create table worker_wages (
  worker_id uuid primary key references workers (id) on delete cascade,
  daily_wage numeric(14, 2) not null default 0,
  currency text not null default 'IQD' check (currency in ('IQD', 'USD')),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id)
);

create type attendance_status as enum ('present', 'half', 'absent', 'leave');

create table attendance (
  worker_id uuid not null references workers (id) on delete cascade,
  day date not null,
  status attendance_status not null,
  overtime_hours numeric(5, 2) not null default 0,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id),
  primary key (worker_id, day)
);

create type payment_kind as enum ('advance', 'bonus', 'deduction', 'salary');

create table worker_payments (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references workers (id) on delete cascade,
  kind payment_kind not null,
  amount numeric(14, 2) not null check (amount > 0),
  currency text not null default 'IQD' check (currency in ('IQD', 'USD')),
  day date not null default current_date,
  note text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id)
);

-- ---------- المخزن ----------
create table materials (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text,
  grade text,
  spec text,
  unit text not null default 'قطعة',
  qty numeric(14, 3) not null default 0,
  min_qty numeric(14, 3),
  unit_price numeric(14, 2) not null default 0,
  currency text not null default 'IQD' check (currency in ('IQD', 'USD')),
  location text,
  notes text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id)
);

-- ---------- أوامر العمل ----------
create type order_status as enum ('new', 'in_progress', 'on_hold', 'done', 'delivered', 'cancelled');
create type order_priority as enum ('normal', 'high', 'urgent');

create sequence work_order_no start 1001;

create table work_orders (
  id uuid primary key default gen_random_uuid(),
  no integer not null unique default nextval('work_order_no'),
  client text,
  client_phone text,
  product text not null,
  qty numeric(14, 3),
  unit text,
  status order_status not null default 'new',
  priority order_priority not null default 'normal',
  start_date date default current_date,
  due_date date,
  owner_id uuid references workers (id) on delete set null,
  machines uuid[] not null default '{}',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id)
);

-- المال منفصل حتى لا يراه إلا المدير والمحاسب
create table work_order_finance (
  order_id uuid primary key references work_orders (id) on delete cascade,
  price numeric(14, 2),
  paid numeric(14, 2) not null default 0,
  cost_labor numeric(14, 2) not null default 0,
  cost_machine numeric(14, 2) not null default 0,
  cost_other numeric(14, 2) not null default 0,
  currency text not null default 'IQD' check (currency in ('IQD', 'USD')),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id)
);

create type stage_status as enum ('waiting', 'working', 'done');

create table work_order_stages (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references work_orders (id) on delete cascade,
  position smallint not null,
  name text not null,
  status stage_status not null default 'waiting',
  machine_id uuid references machines (id) on delete set null,
  note text,
  done_at timestamptz,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id),
  unique (order_id, position)
);

-- مراحل افتراضية لكل أمر جديد
create function add_default_stages() returns trigger language plpgsql as $$
begin
  insert into work_order_stages (order_id, position, name)
  select new.id, s.pos, s.name
  from unnest(array['قص', 'ثني أو درفلة', 'لحام', 'صبغ', 'فحص', 'تسليم']) with ordinality as s(name, pos);
  return new;
end $$;

create trigger work_orders_stages after insert on work_orders
  for each row execute function add_default_stages();

create function stage_done_at() returns trigger language plpgsql as $$
begin
  if new.status = 'done' and old.status is distinct from 'done' then new.done_at := now(); end if;
  if new.status <> 'done' then new.done_at := null; end if;
  return new;
end $$;

create trigger work_order_stages_done before update on work_order_stages
  for each row execute function stage_done_at();

-- ---------- حركة المخزن ----------
create type move_kind as enum ('issue', 'receive', 'adjust');

create table stock_moves (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references materials (id) on delete restrict,
  kind move_kind not null,
  -- موجب دائماً للصرف والاستلام؛ للتسوية يكون موجباً أو سالباً
  qty numeric(14, 3) not null check (qty <> 0),
  unit_price numeric(14, 2) not null default 0,
  order_id uuid references work_orders (id) on delete set null,
  day date not null default current_date,
  note text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) default auth.uid(),
  check (kind = 'adjust' or qty > 0),
  check (kind = 'issue' or order_id is null)
);

-- الكمية بالمخزن تتحدث من الحركات فقط
create function apply_stock_move() returns trigger language plpgsql security definer set search_path = public as $$
declare
  d numeric;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    d := case old.kind when 'issue' then -old.qty else old.qty end;
    update materials set qty = qty - d where id = old.material_id;
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    d := case new.kind when 'issue' then -new.qty else new.qty end;
    update materials set qty = qty + d where id = new.material_id;
    return new;
  end if;
  return old;
end $$;

create function stock_move_price() returns trigger language plpgsql as $$
begin
  if new.unit_price = 0 then
    select unit_price into new.unit_price from materials where id = new.material_id;
  end if;
  return new;
end $$;

create trigger stock_moves_price before insert on stock_moves
  for each row execute function stock_move_price();
create trigger stock_moves_apply after insert or update or delete on stock_moves
  for each row execute function apply_stock_move();

-- ---------- الصيانة ----------
create type maint_kind as enum ('periodic', 'breakdown', 'part', 'inspection');
create type maint_state as enum ('open', 'working', 'done');

create table maintenance (
  id uuid primary key default gen_random_uuid(),
  machine_id uuid not null references machines (id) on delete cascade,
  kind maint_kind not null,
  state maint_state not null default 'open',
  day date not null default current_date,
  done_by text,
  cost numeric(14, 2),
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id)
);

-- ---------- كلفة كل أمر ----------
create view work_order_costs with (security_invoker = true) as
select
  o.id as order_id,
  coalesce((select sum(m.qty * m.unit_price) from stock_moves m where m.order_id = o.id and m.kind = 'issue'), 0) as cost_material,
  f.cost_labor, f.cost_machine, f.cost_other, f.price, f.paid, f.currency,
  coalesce((select sum(m.qty * m.unit_price) from stock_moves m where m.order_id = o.id and m.kind = 'issue'), 0)
    + f.cost_labor + f.cost_machine + f.cost_other as cost_total
from work_orders o
join work_order_finance f on f.order_id = o.id;

-- ---------- updated_at / updated_by ----------
do $$
declare t text;
begin
  foreach t in array array['machines', 'workers', 'worker_wages', 'attendance', 'worker_payments', 'materials',
                           'work_orders', 'work_order_finance', 'work_order_stages', 'maintenance']
  loop
    execute format('create trigger %I_touch before insert or update on %I for each row execute function touch_updated()', t, t);
  end loop;
end $$;

-- ---------- الصلاحيات (RLS) ----------
alter table profiles enable row level security;
alter table machines enable row level security;
alter table workers enable row level security;
alter table worker_wages enable row level security;
alter table attendance enable row level security;
alter table worker_payments enable row level security;
alter table materials enable row level security;
alter table work_orders enable row level security;
alter table work_order_finance enable row level security;
alter table work_order_stages enable row level security;
alter table stock_moves enable row level security;
alter table maintenance enable row level security;

-- الملف الشخصي: الكل يقرأ الأسماء، المدير وحده يعدل
create policy profiles_read on profiles for select using (current_role_name() is not null);
create policy profiles_write on profiles for all using (has_role('manager')) with check (has_role('manager'));

-- جداول يقرأها كل مستخدم فعّال
create policy machines_read on machines for select using (current_role_name() is not null);
create policy workers_read on workers for select using (current_role_name() is not null);
create policy materials_read on materials for select using (current_role_name() is not null);
create policy orders_read on work_orders for select using (current_role_name() is not null);
create policy stages_read on work_order_stages for select using (current_role_name() is not null);
create policy moves_read on stock_moves for select using (current_role_name() is not null);
create policy maint_read on maintenance for select using (current_role_name() is not null);
create policy attendance_read on attendance for select using (has_role('manager', 'production', 'accountant'));

-- المال: المدير والمحاسب فقط
create policy wages_all on worker_wages for all using (has_role('manager', 'accountant')) with check (has_role('manager', 'accountant'));
create policy payments_all on worker_payments for all using (has_role('manager', 'accountant')) with check (has_role('manager', 'accountant'));
create policy finance_all on work_order_finance for all using (has_role('manager', 'accountant')) with check (has_role('manager', 'accountant'));

-- الكتابة حسب الدور
create policy machines_write on machines for all using (has_role('manager', 'production')) with check (has_role('manager', 'production'));
create policy workers_write on workers for all using (has_role('manager', 'production')) with check (has_role('manager', 'production'));
create policy attendance_write on attendance for all using (has_role('manager', 'production')) with check (has_role('manager', 'production'));
create policy orders_write on work_orders for all using (has_role('manager', 'production')) with check (has_role('manager', 'production'));
create policy materials_write on materials for all using (has_role('manager', 'storekeeper')) with check (has_role('manager', 'storekeeper'));
create policy moves_write on stock_moves for all using (has_role('manager', 'storekeeper')) with check (has_role('manager', 'storekeeper'));
-- المشغل يحدّث حالة المراحل، والإنتاج يضيف ويحذف
create policy stages_update on work_order_stages for update using (has_role('manager', 'production', 'operator')) with check (has_role('manager', 'production', 'operator'));
create policy stages_insert on work_order_stages for insert with check (has_role('manager', 'production'));
create policy stages_delete on work_order_stages for delete using (has_role('manager', 'production'));
-- أي مستخدم فعّال يبلّغ عن عطل؛ الإنتاج والمدير يعدّلون
create policy maint_insert on maintenance for insert with check (current_role_name() is not null);
create policy maint_change on maintenance for update using (has_role('manager', 'production')) with check (has_role('manager', 'production'));
create policy maint_delete on maintenance for delete using (has_role('manager', 'production'));

-- ---------- الرواتب الشهرية ----------
create view monthly_payroll with (security_invoker = true) as
with months as (
  select distinct date_trunc('month', day)::date as month from attendance
  union select distinct date_trunc('month', day)::date from worker_payments
)
select
  w.id as worker_id, w.full_name, mo.month,
  coalesce(ww.daily_wage, 0) as daily_wage, coalesce(ww.currency, 'IQD') as currency,
  coalesce(a.days, 0) as days, coalesce(a.overtime, 0) as overtime_hours,
  coalesce(a.days, 0) * coalesce(ww.daily_wage, 0) as earned,
  coalesce(p.bonus, 0) as bonus, coalesce(p.deduction, 0) as deduction,
  coalesce(p.advance, 0) as advance, coalesce(p.salary, 0) as paid,
  coalesce(a.days, 0) * coalesce(ww.daily_wage, 0) + coalesce(p.bonus, 0)
    - coalesce(p.deduction, 0) - coalesce(p.advance, 0) - coalesce(p.salary, 0) as balance
from workers w
cross join months mo
left join worker_wages ww on ww.worker_id = w.id
left join lateral (
  select sum(case status when 'present' then 1 when 'half' then 0.5 else 0 end) as days, sum(overtime_hours) as overtime
  from attendance where worker_id = w.id and date_trunc('month', day) = mo.month
) a on true
left join lateral (
  select sum(amount) filter (where kind = 'bonus') as bonus, sum(amount) filter (where kind = 'deduction') as deduction,
         sum(amount) filter (where kind = 'advance') as advance, sum(amount) filter (where kind = 'salary') as salary
  from worker_payments where worker_id = w.id and date_trunc('month', day) = mo.month
) p on true;
