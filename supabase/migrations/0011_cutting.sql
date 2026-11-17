-- المرحلة 1 من الخطة: الألواح بالقطعة، مخططات القص، وحساب الهدر والخسارة
-- يشغَّل مرة واحدة من SQL Editor بعد 0010

-- إعدادات القص
alter table settings add column kerf_mm numeric(6, 2) not null default 3;            -- عرض خط القص
alter table settings add column edge_mm numeric(6, 2) not null default 10;           -- حافة اللوح غير المستغلة
alter table settings add column min_remnant_mm numeric(8, 1) not null default 300;   -- أصغر بقية تنحفظ
alter table settings add column scrap_price numeric(12, 2) not null default 0;       -- سعر بيع كغم السكراب بالدينار
alter table settings add column plate_sizes text not null default '6000x1500, 6000x2000';  -- القياسات القياسية لاقتراح الشراء
alter table settings add column loss_alert_pct numeric(5, 2) not null default 20;    -- تنبيه إذا زاد الهدر عن هذي النسبة

-- ---------- الألواح: كل لوح بقطعته ----------
create type plate_status as enum ('available', 'reserved', 'cut');

create table plates (
  id uuid primary key default gen_random_uuid(),
  serial int generated always as identity,
  grade text not null default 'A36',            -- A36، A516 Gr70، SS304 ...
  thickness numeric(8, 2) not null check (thickness > 0),
  length_mm numeric(10, 1) not null check (length_mm > 0),
  width_mm numeric(10, 1) not null check (width_mm > 0),
  density numeric(5, 3) not null default 7.85,
  heat_no text,
  cert_no text,
  price_kg numeric(12, 2) not null default 0,   -- سعر الكغم بالدينار
  location text,
  status plate_status not null default 'available',
  parent_id uuid references plates (id) on delete set null,      -- إذا هو بقية من لوح
  from_order_id uuid references work_orders (id) on delete set null,
  supplier_id uuid references suppliers (id) on delete set null,
  received_on date not null default current_date,
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) default auth.uid()
);
create index plates_pick on plates (grade, thickness, status);

-- ---------- القطع المطلوب قصها لكل أمر ----------
create type cut_shape as enum ('rect', 'circle', 'ring');

create table cut_parts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references work_orders (id) on delete cascade,
  name text not null,
  shape cut_shape not null default 'rect',
  grade text not null default 'A36',
  thickness numeric(8, 2) not null check (thickness > 0),
  length_mm numeric(10, 1),        -- للمستطيل
  width_mm numeric(10, 1),
  diameter_mm numeric(10, 1),      -- للدائرة والحلقة (القطر الخارجي)
  inner_mm numeric(10, 1),         -- قطر فتحة الحلقة
  qty int not null default 1 check (qty > 0),
  created_at timestamptz not null default now(),
  check ((shape = 'rect' and length_mm > 0 and width_mm > 0) or (shape <> 'rect' and diameter_mm > 0)),
  check (shape <> 'ring' or (inner_mm > 0 and inner_mm < diameter_mm))
);
create index cut_parts_order on cut_parts (order_id);

-- ---------- مخطط القص: لوح واحد وترتيب القطع عليه ----------
create table cut_plans (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references work_orders (id) on delete cascade,
  plate_id uuid not null references plates (id) on delete restrict,
  status text not null default 'draft' check (status in ('draft', 'done')),
  layout jsonb not null default '[]',      -- [{part_id, name, shape, x, y, w, h, d, inner, rot}]
  remnants jsonb not null default '[]',    -- البقايا المقترحة [{x, y, w, h}]
  plate_kg numeric(12, 2) not null,
  parts_kg numeric(12, 2) not null,
  remnant_kg numeric(12, 2) not null default 0,
  scrap_kg numeric(12, 2) not null,
  price_kg numeric(12, 2) not null default 0,
  scrap_price numeric(12, 2) not null default 0,
  material_cost numeric(14, 2) generated always as ((plate_kg - remnant_kg) * price_kg - scrap_kg * scrap_price) stored,  -- كلفة المادة على الأمر (ناقص قيمة بيع السكراب)
  loss_value numeric(14, 2) generated always as (scrap_kg * (price_kg - scrap_price)) stored,      -- الخسارة الصافية بالهدر
  done_at timestamptz,
  done_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) default auth.uid()
);
create index cut_plans_order on cut_plans (order_id);
create unique index cut_plans_one_open on cut_plans (plate_id) where status = 'draft';

-- ---------- الصلاحيات ----------
alter table plates enable row level security;
alter table cut_parts enable row level security;
alter table cut_plans enable row level security;
create policy plates_read on plates for select using (current_role_name() is not null);
create policy plates_write on plates for all
  using (has_role('manager', 'production', 'storekeeper')) with check (has_role('manager', 'production', 'storekeeper'));
create policy cut_parts_read on cut_parts for select using (current_role_name() is not null);
create policy cut_parts_write on cut_parts for all using (has_role('manager', 'production')) with check (has_role('manager', 'production'));
create policy cut_plans_read on cut_plans for select using (current_role_name() is not null);
create policy cut_plans_write on cut_plans for all using (has_role('manager', 'production')) with check (has_role('manager', 'production'));
grant select, insert, update, delete on plates, cut_parts, cut_plans to authenticated;

do $$
declare t text;
begin
  foreach t in array array['plates', 'cut_parts', 'cut_plans']
  loop
    execute format('create trigger %I_audit after insert or update or delete on %I for each row execute function audit()', t, t);
  end loop;
end $$;

-- ---------- تنفيذ القص: اللوح ينصرف، البقايا ترجع ألواح، والهدر ينسجل ----------
create function finish_cut(p_plan uuid, p_remnants jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare
  c cut_plans;
  pl plates;
  r jsonb;
  rkg numeric := 0;
  kg numeric;
begin
  if not has_role('manager', 'production') then
    raise exception 'ليس لديك صلاحية' using errcode = '42501';
  end if;
  select * into c from cut_plans where id = p_plan for update;
  if c.id is null or c.status <> 'draft' then
    raise exception 'المخطط غير موجود أو منفذ من قبل';
  end if;
  select * into pl from plates where id = c.plate_id for update;
  if pl.status = 'cut' then
    raise exception 'هذا اللوح انقص من قبل';
  end if;
  -- البقايا اللي فعلاً انحفظت (المستخدم يأكدها أو يعدلها)
  for r in select * from jsonb_array_elements(coalesce(p_remnants, '[]'::jsonb)) loop
    if (r->>'w')::numeric > 0 and (r->>'h')::numeric > 0 then
      kg := (r->>'w')::numeric * (r->>'h')::numeric * pl.thickness * pl.density / 1e6;
      rkg := rkg + kg;
      insert into plates (grade, thickness, length_mm, width_mm, density, heat_no, cert_no, price_kg, location, parent_id, from_order_id, supplier_id, notes)
      values (pl.grade, pl.thickness, greatest((r->>'w')::numeric, (r->>'h')::numeric), least((r->>'w')::numeric, (r->>'h')::numeric),
              pl.density, pl.heat_no, pl.cert_no, pl.price_kg, pl.location, pl.id, c.order_id, pl.supplier_id, 'بقية من لوح #' || pl.serial);
    end if;
  end loop;
  kg := greatest(0, c.plate_kg - c.parts_kg - rkg);
  update cut_plans set status = 'done', remnant_kg = round(rkg, 2), scrap_kg = round(kg, 2), remnants = coalesce(p_remnants, '[]'::jsonb),
    done_at = now(), done_by = auth.uid() where id = c.id;
  update plates set status = 'cut' where id = pl.id;
  if kg > 0 then
    insert into scrap (order_id, day, kg, reason) values (c.order_id, (now() at time zone 'Asia/Baghdad')::date, round(kg, 2), 'هدر قص لوح #' || pl.serial);
  end if;
end $$;
grant execute on function finish_cut(uuid, jsonb) to authenticated;

-- كلفة الأمر صارت تشمل الألواح المقصوصة (اللوح ناقص البقايا الراجعة)
create or replace view work_order_costs with (security_invoker = true) as
select
  o.id as order_id,
  coalesce((select sum(m.qty * m.unit_price) from stock_moves m where m.order_id = o.id and m.kind = 'issue'), 0)
    + coalesce((select sum(c.material_cost) from cut_plans c where c.order_id = o.id and c.status = 'done'), 0) as cost_material,
  f.cost_labor, f.cost_machine, f.cost_other, f.price, f.paid, f.currency,
  coalesce((select sum(m.qty * m.unit_price) from stock_moves m where m.order_id = o.id and m.kind = 'issue'), 0)
    + coalesce((select sum(c.material_cost) from cut_plans c where c.order_id = o.id and c.status = 'done'), 0)
    + f.cost_labor + f.cost_machine + f.cost_other
    + coalesce((select sum(s.hours * mc.hour_rate) from work_order_stages s join machines mc on mc.id = s.machine_id
                where s.order_id = o.id and s.hours is not null), 0) as cost_total,
  coalesce((select sum(s.hours * mc.hour_rate) from work_order_stages s join machines mc on mc.id = s.machine_id
            where s.order_id = o.id and s.hours is not null), 0) as cost_machine_hours,
  coalesce((select sum(c.loss_value) from cut_plans c where c.order_id = o.id and c.status = 'done'), 0) as cut_loss
from work_orders o
join work_order_finance f on f.order_id = o.id;

-- تقرير الهدر الشهري
create view cut_loss_monthly with (security_invoker = true) as
select date_trunc('month', c.done_at at time zone 'Asia/Baghdad')::date as month,
  p.grade, p.thickness,
  count(*) as plates, sum(c.plate_kg) as plate_kg, sum(c.parts_kg) as parts_kg,
  sum(c.remnant_kg) as remnant_kg, sum(c.scrap_kg) as scrap_kg, sum(c.loss_value) as loss_value
from cut_plans c join plates p on p.id = c.plate_id
where c.status = 'done'
group by 1, 2, 3;
grant select on cut_loss_monthly to authenticated;
