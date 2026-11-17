-- الدفعة الثانية: المبيعات (الزبائن، عروض الأسعار، الفواتير، المقبوضات) وإعدادات المعمل
-- يشغَّل مرة واحدة من SQL Editor بعد 0004

-- ---------- إعدادات المعمل (صف واحد) ----------
create table settings (
  id int primary key default 1 check (id = 1),
  factory_name text not null default 'معمل السكب الحديدي',
  address text,
  phone text,
  invoice_footer text,
  usd_rate numeric(12, 2) not null default 1500,  -- دينار لكل دولار
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id)
);
insert into settings (id) values (1) on conflict do nothing;
create trigger settings_touch before update on settings for each row execute function touch_updated();

-- ---------- الزبائن ----------
create table customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  address text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id)
);
create unique index customers_name on customers (lower(name));
create trigger customers_touch before update on customers for each row execute function touch_updated();

alter table work_orders add column customer_id uuid references customers (id) on delete set null;

-- الزبائن الموجودين بأوامر العمل يندخلون تلقائياً
insert into customers (name, phone)
select distinct on (lower(btrim(client))) btrim(client), client_phone
from work_orders where client is not null and btrim(client) <> ''
order by lower(btrim(client)), created_at desc
on conflict do nothing;
update work_orders o set customer_id = c.id from customers c where lower(btrim(o.client)) = lower(c.name);

-- ---------- عروض الأسعار ----------
create type quote_status as enum ('draft', 'sent', 'accepted', 'rejected');
create sequence quote_no start 1;

create table quotes (
  id uuid primary key default gen_random_uuid(),
  no int not null unique default nextval('quote_no'),
  customer_id uuid references customers (id) on delete set null,
  day date not null default current_date,
  valid_until date,
  status quote_status not null default 'draft',
  currency text not null default 'IQD' check (currency in ('IQD', 'USD')),
  discount numeric(16, 2) not null default 0,
  notes text,
  order_id uuid references work_orders (id) on delete set null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) default auth.uid(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id)
);
create trigger quotes_touch before update on quotes for each row execute function touch_updated();

-- ---------- الفواتير ----------
create sequence invoice_no start 1;

create table invoices (
  id uuid primary key default gen_random_uuid(),
  no int not null unique default nextval('invoice_no'),
  customer_id uuid not null references customers (id) on delete restrict,
  order_id uuid references work_orders (id) on delete set null,
  quote_id uuid references quotes (id) on delete set null,
  day date not null default current_date,
  due_date date,
  currency text not null default 'IQD' check (currency in ('IQD', 'USD')),
  discount numeric(16, 2) not null default 0,
  notes text,
  cancelled boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) default auth.uid(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id)
);
create index invoices_customer on invoices (customer_id);
create trigger invoices_touch before update on invoices for each row execute function touch_updated();

-- بنود العرض والفاتورة بنفس الشكل
create table quote_lines (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references quotes (id) on delete cascade,
  position int not null default 0,
  description text not null,
  qty numeric(14, 3) not null default 1,
  unit text,
  unit_price numeric(16, 2) not null default 0
);
create table invoice_lines (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices (id) on delete cascade,
  position int not null default 0,
  description text not null,
  qty numeric(14, 3) not null default 1,
  unit text,
  unit_price numeric(16, 2) not null default 0
);
create index quote_lines_q on quote_lines (quote_id);
create index invoice_lines_i on invoice_lines (invoice_id);

-- ---------- المقبوضات ----------
create table customer_payments (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers (id) on delete restrict,
  invoice_id uuid references invoices (id) on delete set null,
  day date not null default current_date,
  amount numeric(16, 2) not null check (amount > 0),
  currency text not null default 'IQD' check (currency in ('IQD', 'USD')),
  method text not null default 'cash' check (method in ('cash', 'transfer', 'cheque')),
  note text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) default auth.uid()
);
create index customer_payments_customer on customer_payments (customer_id);

-- القبض على فاتورة مربوطة بأمر عمل يحدّث «المستلم» بالأمر، حتى يبقى الربح صحيح
create function payment_to_order() returns trigger language plpgsql security definer set search_path = public as $$
declare oid uuid; delta numeric;
begin
  if tg_op = 'INSERT' then
    select order_id into oid from invoices where id = new.invoice_id; delta := new.amount;
  else
    select order_id into oid from invoices where id = old.invoice_id; delta := -old.amount;
  end if;
  if oid is not null then
    update work_order_finance set paid = greatest(0, paid + delta) where order_id = oid;
  end if;
  return null;
end $$;
create trigger customer_payments_order after insert or delete on customer_payments
  for each row execute function payment_to_order();

-- ---------- المجاميع ----------
create view quote_totals with (security_invoker = true) as
select q.id as quote_id,
  coalesce(sum(l.qty * l.unit_price), 0) as subtotal,
  coalesce(sum(l.qty * l.unit_price), 0) - q.discount as total
from quotes q left join quote_lines l on l.quote_id = q.id
group by q.id;

create view invoice_totals with (security_invoker = true) as
select i.id as invoice_id, i.customer_id, i.currency, i.cancelled,
  coalesce(l.subtotal, 0) as subtotal,
  coalesce(l.subtotal, 0) - i.discount as total,
  coalesce(p.paid, 0) as paid,
  case when i.cancelled then 0 else coalesce(l.subtotal, 0) - i.discount - coalesce(p.paid, 0) end as balance
from invoices i
left join lateral (select sum(qty * unit_price) as subtotal from invoice_lines where invoice_id = i.id) l on true
left join lateral (select sum(amount) as paid from customer_payments where invoice_id = i.id) p on true;

-- رصيد كل زبون بكل عملة: الفواتير ناقص كل المقبوضات (حتى غير المربوطة بفاتورة)
create view customer_balances with (security_invoker = true) as
with inv as (
  select customer_id, currency, sum(total) as invoiced from invoice_totals where not cancelled group by 1, 2
), pay as (
  select customer_id, currency, sum(amount) as paid from customer_payments group by 1, 2
)
select coalesce(inv.customer_id, pay.customer_id) as customer_id,
  coalesce(inv.currency, pay.currency) as currency,
  coalesce(invoiced, 0) as invoiced, coalesce(paid, 0) as paid,
  coalesce(invoiced, 0) - coalesce(paid, 0) as balance
from inv full join pay on pay.customer_id = inv.customer_id and pay.currency = inv.currency;

-- ---------- الصلاحيات ----------
alter table settings enable row level security;
alter table customers enable row level security;
alter table quotes enable row level security;
alter table quote_lines enable row level security;
alter table invoices enable row level security;
alter table invoice_lines enable row level security;
alter table customer_payments enable row level security;

create policy settings_read on settings for select using (current_role_name() is not null);
create policy settings_write on settings for update using (has_role('manager')) with check (has_role('manager'));
create policy customers_read on customers for select using (current_role_name() is not null);
create policy customers_write on customers for all
  using (has_role('manager', 'accountant', 'production')) with check (has_role('manager', 'accountant', 'production'));
create policy quotes_all on quotes for all using (has_role('manager', 'accountant')) with check (has_role('manager', 'accountant'));
create policy quote_lines_all on quote_lines for all using (has_role('manager', 'accountant')) with check (has_role('manager', 'accountant'));
create policy invoices_all on invoices for all using (has_role('manager', 'accountant')) with check (has_role('manager', 'accountant'));
create policy invoice_lines_all on invoice_lines for all using (has_role('manager', 'accountant')) with check (has_role('manager', 'accountant'));
create policy customer_payments_all on customer_payments for all
  using (has_role('manager', 'accountant')) with check (has_role('manager', 'accountant'));

grant select, insert, update, delete on settings, customers, quotes, quote_lines, invoices, invoice_lines, customer_payments to authenticated;
grant select on quote_totals, invoice_totals, customer_balances to authenticated;
grant usage, select on sequence quote_no, invoice_no to authenticated;

-- ---------- سجل التعديلات ----------
-- row_id يقبل بس المعرفات من نوع uuid (جدول الإعدادات رقمه 1)
create or replace function audit() returns trigger language plpgsql security definer set search_path = public as $$
declare
  o jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  n jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  r jsonb := coalesce(n, o);
  rid text := coalesce(r ->> 'id', r ->> 'order_id', r ->> 'worker_id');
  diff jsonb := '{}';
  k text;
begin
  if tg_op = 'UPDATE' then
    for k in select jsonb_object_keys(n) loop
      if k not in ('updated_at', 'updated_by') and (o -> k) is distinct from (n -> k) then
        diff := diff || jsonb_build_object(k, jsonb_build_array(o -> k, n -> k));
      end if;
    end loop;
    if diff = '{}' then return null; end if;
  end if;
  insert into audit_log (table_name, row_id, action, changes)
  values (tg_table_name,
          case when rid ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then rid::uuid end,
          lower(tg_op),
          case tg_op when 'UPDATE' then diff else r end);
  return null;
end $$;

do $$
declare t text;
begin
  foreach t in array array['customers', 'quotes', 'invoices', 'customer_payments', 'settings']
  loop
    execute format('create trigger %I_audit after insert or update or delete on %I for each row execute function audit()', t, t);
  end loop;
end $$;
