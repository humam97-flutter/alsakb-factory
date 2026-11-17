-- المرحلة 3: التسعير التقديري وقائمة المواد، والمقدّر مقابل الفعلي
-- يشغَّل مرة واحدة من SQL Editor بعد 0012

-- أسعار الكلف الافتراضية (تتعدل من صفحة الأسعار). كلها بالدينار
alter table settings add column est_rates jsonb not null default '{}';

create sequence estimate_no start 1;

create table estimates (
  id uuid primary key default gen_random_uuid(),
  no int not null unique default nextval('estimate_no'),
  title text not null,
  customer_id uuid references customers (id) on delete set null,
  product_type text not null default 'vessel' check (product_type in ('vessel', 'tank', 'structure', 'other')),
  calc_id uuid references calcs (id) on delete set null,     -- الحساب الهندسي اللي انولد منه
  weight_kg numeric(14, 2),                                  -- الوزن الصافي للمنتج
  qty int not null default 1 check (qty > 0),                -- عدد القطع بنفس المواصفات
  status text not null default 'draft' check (status in ('draft', 'quoted', 'won', 'lost')),
  currency text not null default 'IQD' check (currency in ('IQD', 'USD')),
  overhead_pct numeric(6, 2) not null default 12,            -- مصاريف عامة
  contingency_pct numeric(6, 2) not null default 5,          -- احتياط
  margin_pct numeric(6, 2) not null default 20,              -- هامش الربح
  quote_id uuid references quotes (id) on delete set null,
  order_id uuid references work_orders (id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) default auth.uid(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id)
);
create trigger estimates_touch before update on estimates for each row execute function touch_updated();
create index estimates_order on estimates (order_id);

create table estimate_lines (
  id uuid primary key default gen_random_uuid(),
  estimate_id uuid not null references estimates (id) on delete cascade,
  position int not null default 0,
  category text not null check (category in ('material', 'consumable', 'labor', 'ndt', 'paint', 'subcontract', 'other')),
  description text not null,
  qty numeric(14, 3) not null default 1,
  unit text,
  unit_cost numeric(16, 2) not null default 0
);
create index estimate_lines_e on estimate_lines (estimate_id);

-- المجاميع: الكلفة المباشرة ← + مصاريف عامة + احتياط ← + ربح = السعر (لكل القطع)
create view estimate_totals with (security_invoker = true) as
select e.id as estimate_id, e.currency,
  coalesce(sum(l.qty * l.unit_cost) filter (where l.category in ('material', 'consumable')), 0) * e.qty as material,
  coalesce(sum(l.qty * l.unit_cost) filter (where l.category = 'labor'), 0) * e.qty as labor,
  coalesce(sum(l.qty * l.unit_cost) filter (where l.category not in ('material', 'consumable', 'labor')), 0) * e.qty as other,
  coalesce(sum(l.qty * l.unit_cost), 0) * e.qty as direct,
  coalesce(sum(l.qty) filter (where l.category = 'labor' and l.unit = 'ساعة'), 0) * e.qty as hours,
  round(coalesce(sum(l.qty * l.unit_cost), 0) * e.qty * (1 + e.overhead_pct / 100) * (1 + e.contingency_pct / 100), 2) as cost,
  round(coalesce(sum(l.qty * l.unit_cost), 0) * e.qty * (1 + e.overhead_pct / 100) * (1 + e.contingency_pct / 100) * (1 + e.margin_pct / 100), -3) as price
from estimates e left join estimate_lines l on l.estimate_id = e.id
group by e.id;

-- الصلاحيات: المدير والمحاسب (أسعار وأرباح)
alter table estimates enable row level security;
alter table estimate_lines enable row level security;
create policy estimates_all on estimates for all using (has_role('manager', 'accountant')) with check (has_role('manager', 'accountant'));
create policy estimate_lines_all on estimate_lines for all using (has_role('manager', 'accountant')) with check (has_role('manager', 'accountant'));
grant select, insert, update, delete on estimates, estimate_lines to authenticated;
grant usage, select on sequence estimate_no to authenticated;
grant select on estimate_totals to authenticated;

do $$
declare t text;
begin
  foreach t in array array['estimates', 'estimate_lines']
  loop
    execute format('create trigger %I_audit after insert or update or delete on %I for each row execute function audit()', t, t);
  end loop;
end $$;
