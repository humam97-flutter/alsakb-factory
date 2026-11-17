-- المرحلة 5: تخطيط الإنتاج: مراكز العمل، خطة كل مرحلة (ساعات وتواريخ)، والتقدم بالوزن
-- يشغَّل مرة واحدة من SQL Editor بعد 0015

-- ---------- مراكز العمل ----------
create table work_centers (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  kind text not null default 'other',            -- cut, roll, fit, weld, grind, test, paint, other
  hours_day numeric(5, 2) not null default 8,    -- ساعات الشغل باليوم
  people smallint not null default 1,            -- عدد العمال أو المكائن اللي تشتغل سوية
  efficiency numeric(5, 2) not null default 85,  -- الكفاءة الفعلية %
  color smallint not null default 0,
  position smallint not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into work_centers (code, name, kind, hours_day, people, efficiency, color, position) values
  ('CUT', 'القص وتحضير الحواف', 'cut', 8, 2, 85, 0, 1),
  ('ROLL', 'الدرفلة والثني', 'roll', 8, 1, 80, 1, 2),
  ('FIT', 'التجميع والتركيب', 'fit', 8, 3, 85, 2, 3),
  ('WELD', 'اللحام', 'weld', 8, 4, 80, 3, 4),
  ('GRIND', 'الجلخ والتشطيب', 'grind', 8, 2, 85, 4, 5),
  ('TEST', 'الفحص والاختبار', 'test', 8, 1, 90, 6, 6),
  ('PAINT', 'السفع والصبغ', 'paint', 8, 2, 85, 5, 7);

alter table machines add column work_center_id uuid references work_centers (id) on delete set null;

-- ---------- وزن الأمر ونوعه (للتخطيط والتقدم بالطن) ----------
alter table work_orders add column weight_kg numeric(12, 2);
alter table work_orders add column product_type text;   -- vessel, tank, structure, other

-- ---------- خطة كل مرحلة ----------
alter table work_order_stages add column work_center_id uuid references work_centers (id) on delete set null;
alter table work_order_stages add column plan_hours numeric(8, 2);
alter table work_order_stages add column plan_start date;
alter table work_order_stages add column plan_end date;
alter table work_order_stages add column weight_pct numeric(5, 2);   -- حصة المرحلة من شغل الأمر %
alter table work_order_stages add column progress smallint not null default 0 check (progress between 0 and 100);
create index work_order_stages_plan on work_order_stages (work_center_id, plan_start) where plan_start is not null;

-- المرحلة المنجزة = 100%، والراجعة للانتظار = 0
create or replace function stage_done_at() returns trigger language plpgsql as $$
begin
  if new.status = 'done' and old.status is distinct from 'done' then new.done_at := now(); new.progress := 100; end if;
  if new.status <> 'done' then new.done_at := null; end if;
  if new.status = 'waiting' and old.status = 'done' then new.progress := 0; end if;
  if new.progress = 100 and new.status <> 'done' and old.progress is distinct from 100 then new.status := 'done'; new.done_at := now(); end if;
  return new;
end $$;

-- ---------- أيام العطلة الأسبوعية (0 الأحد ... 5 الجمعة، 6 السبت) ----------
alter table settings add column off_days smallint[] not null default '{5}';

-- ---------- الصلاحيات ----------
alter table work_centers enable row level security;
create policy work_centers_read on work_centers for select using (current_role_name() is not null);
create policy work_centers_write on work_centers for all using (has_role('manager', 'production')) with check (has_role('manager', 'production'));
grant select, insert, update, delete on work_centers to authenticated;
create trigger work_centers_audit after insert or update or delete on work_centers for each row execute function audit();
