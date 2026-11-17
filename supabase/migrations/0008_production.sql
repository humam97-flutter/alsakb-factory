-- الدفعة الخامسة: الإنتاج والصيانة
-- كلفة ساعة الماكنة، ساعات المراحل، الجودة، الهدر وبقايا الصاج، الصيانة الدورية، صرف قطع الغيار
-- يشغَّل مرة واحدة من SQL Editor بعد 0007

-- ---------- كلفة ساعة الماكنة وساعات كل مرحلة ----------
alter table machines add column hour_rate numeric(14, 2) not null default 0;  -- كهرباء + استهلاك + غاز، بالدينار
alter table work_order_stages add column hours numeric(8, 2);                 -- ساعات التشغيل الفعلية
alter table work_order_stages add column worker_id uuid references workers (id) on delete set null;

-- كلفة الأمر: صارت تضيف ساعات المكائن × كلفة الساعة تلقائياً
create or replace view work_order_costs with (security_invoker = true) as
select
  o.id as order_id,
  coalesce((select sum(m.qty * m.unit_price) from stock_moves m where m.order_id = o.id and m.kind = 'issue'), 0) as cost_material,
  f.cost_labor, f.cost_machine, f.cost_other, f.price, f.paid, f.currency,
  coalesce((select sum(m.qty * m.unit_price) from stock_moves m where m.order_id = o.id and m.kind = 'issue'), 0)
    + f.cost_labor + f.cost_machine + f.cost_other
    + coalesce((select sum(s.hours * mc.hour_rate) from work_order_stages s join machines mc on mc.id = s.machine_id
                where s.order_id = o.id and s.hours is not null), 0) as cost_total,
  coalesce((select sum(s.hours * mc.hour_rate) from work_order_stages s join machines mc on mc.id = s.machine_id
            where s.order_id = o.id and s.hours is not null), 0) as cost_machine_hours
from work_orders o
join work_order_finance f on f.order_id = o.id;

-- ---------- فحص الجودة ----------
create table quality_checks (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references work_orders (id) on delete cascade,
  day date not null default current_date,
  result text not null check (result in ('pass', 'rework', 'fail')),
  checks jsonb not null default '{}',  -- {"الأبعاد": true, "اللحام": false, ...}
  inspector text,
  note text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) default auth.uid()
);
create index quality_checks_order on quality_checks (order_id);

-- ---------- الهدر (سكراب) لكل أمر ----------
create table scrap (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references work_orders (id) on delete cascade,
  machine_id uuid references machines (id) on delete set null,
  material_id uuid references materials (id) on delete set null,
  day date not null default current_date,
  kg numeric(12, 2) not null check (kg > 0),
  reason text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) default auth.uid()
);
create index scrap_order on scrap (order_id);

-- ---------- بقايا الصاج والقطع المتبقية ----------
create table offcuts (
  id uuid primary key default gen_random_uuid(),
  material_id uuid references materials (id) on delete set null,
  description text,
  thickness numeric(8, 2),
  length_mm numeric(10, 1),
  width_mm numeric(10, 1),
  pieces int not null default 1 check (pieces > 0),
  location text,
  from_order_id uuid references work_orders (id) on delete set null,
  used_order_id uuid references work_orders (id) on delete set null,
  used_at date,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) default auth.uid()
);

-- ---------- خطط الصيانة الدورية ----------
create table maintenance_plans (
  id uuid primary key default gen_random_uuid(),
  machine_id uuid not null references machines (id) on delete cascade,
  task text not null,             -- تبديل زيت، تنظيف عدسة، فحص فوهات...
  every_days int not null check (every_days > 0),
  last_done date,
  next_due date not null default current_date,
  active boolean not null default true,
  notes text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id)
);
create trigger maintenance_plans_touch before update on maintenance_plans for each row execute function touch_updated();

-- ---------- قطع الغيار المصروفة على الصيانة ----------
alter table stock_moves add column maintenance_id uuid references maintenance (id) on delete cascade;

-- مدير الإنتاج يصرف قطعة غيار على صيانة، حتى لو ما عنده صلاحية المخزن
create function issue_part(p_maintenance uuid, p_material uuid, p_qty numeric) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not has_role('manager', 'production', 'storekeeper') then
    raise exception 'ليس لديك صلاحية' using errcode = '42501';
  end if;
  if p_qty is null or p_qty <= 0 then raise exception 'الكمية لازم تكون أكبر من صفر'; end if;
  insert into stock_moves (material_id, kind, qty, maintenance_id, note)
  select p_material, 'issue', p_qty, m.id, 'صيانة: ' || mc.name
  from maintenance m join machines mc on mc.id = m.machine_id where m.id = p_maintenance;
end $$;

-- كلفة الصيانة الكاملة: المكتوبة + قطع الغيار
create view maintenance_costs with (security_invoker = true) as
select m.id as maintenance_id, m.machine_id, m.day,
  coalesce(m.cost, 0) as cost_manual,
  coalesce((select sum(s.qty * s.unit_price) from stock_moves s where s.maintenance_id = m.id), 0) as cost_parts,
  coalesce(m.cost, 0) + coalesce((select sum(s.qty * s.unit_price) from stock_moves s where s.maintenance_id = m.id), 0) as cost_total
from maintenance m;

-- ---------- الصلاحيات ----------
alter table quality_checks enable row level security;
alter table scrap enable row level security;
alter table offcuts enable row level security;
alter table maintenance_plans enable row level security;

create policy quality_read on quality_checks for select using (current_role_name() is not null);
create policy quality_write on quality_checks for all using (has_role('manager', 'production')) with check (has_role('manager', 'production'));
create policy scrap_read on scrap for select using (current_role_name() is not null);
create policy scrap_write on scrap for all
  using (has_role('manager', 'production', 'storekeeper', 'operator')) with check (has_role('manager', 'production', 'storekeeper', 'operator'));
create policy offcuts_read on offcuts for select using (current_role_name() is not null);
create policy offcuts_write on offcuts for all
  using (has_role('manager', 'production', 'storekeeper')) with check (has_role('manager', 'production', 'storekeeper'));
create policy plans_read on maintenance_plans for select using (current_role_name() is not null);
create policy plans_write on maintenance_plans for all using (has_role('manager', 'production')) with check (has_role('manager', 'production'));

grant select, insert, update, delete on quality_checks, scrap, offcuts, maintenance_plans to authenticated;
grant select on maintenance_costs to authenticated;
grant execute on function issue_part(uuid, uuid, numeric) to authenticated;

do $$
declare t text;
begin
  foreach t in array array['quality_checks', 'scrap', 'offcuts', 'maintenance_plans']
  loop
    execute format('create trigger %I_audit after insert or update or delete on %I for each row execute function audit()', t, t);
  end loop;
end $$;

-- التقرير الشهري: الصيانة صارت تشمل قطع الغيار
create or replace view monthly_pnl with (security_invoker = true) as
with m as (
  select date_trunc('month', i.day)::date as month, i.currency, sum(t.total) as revenue, 0::numeric as materials, 0::numeric as wages,
         0::numeric as expenses, 0::numeric as maintenance, 0::numeric as services
  from invoices i join invoice_totals t on t.invoice_id = i.id where not i.cancelled group by 1, 2
  union all
  select date_trunc('month', s.day)::date, mt.currency, 0, sum(s.qty * s.unit_price), 0, 0, 0, 0
  from stock_moves s join materials mt on mt.id = s.material_id where s.kind = 'issue' and s.maintenance_id is null group by 1, 2
  union all
  select month, currency, 0, 0, sum(earned + bonus - deduction), 0, 0, 0 from monthly_payroll group by 1, 2
  union all
  select date_trunc('month', day)::date, currency, 0, 0, 0, sum(amount), 0, 0 from expenses group by 1, 2
  union all
  select date_trunc('month', day)::date, 'IQD', 0, 0, 0, 0, sum(cost_total), 0 from maintenance_costs group by 1, 2
  union all
  select date_trunc('month', i.day)::date, i.currency, 0, 0, 0, 0, 0, sum(l.qty * l.unit_price)
  from purchase_lines l join purchase_invoices i on i.id = l.invoice_id where l.material_id is null group by 1, 2
)
select month, currency,
  sum(revenue) as revenue, sum(materials) as materials, sum(wages) as wages,
  sum(expenses) as expenses, sum(maintenance) as maintenance, sum(services) as services,
  sum(revenue) - sum(materials) - sum(wages) - sum(expenses) - sum(maintenance) - sum(services) as profit
from m group by month, currency;
