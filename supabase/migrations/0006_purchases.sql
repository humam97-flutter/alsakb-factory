-- الدفعة الثالثة: المشتريات (الموردين، طلبات الشراء، فواتير الشراء، تسديد الموردين)
-- يشغَّل مرة واحدة من SQL Editor بعد 0005

-- ---------- الموردين ----------
create table suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  address text,
  supplies text,  -- شنو يجهّز: صاج، أنابيب، أصباغ، غازات...
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id)
);
create unique index suppliers_name on suppliers (lower(name));
create trigger suppliers_touch before update on suppliers for each row execute function touch_updated();

-- ---------- طلبات الشراء ----------
create type purchase_request_status as enum ('pending', 'approved', 'rejected', 'bought');

create table purchase_requests (
  id uuid primary key default gen_random_uuid(),
  material_id uuid references materials (id) on delete set null,
  description text not null,
  qty numeric(14, 3),
  unit text,
  needed_by date,
  supplier_id uuid references suppliers (id) on delete set null,
  status purchase_request_status not null default 'pending',
  note text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) default auth.uid(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id)
);
create trigger purchase_requests_touch before update on purchase_requests for each row execute function touch_updated();

-- ---------- فواتير الشراء ----------
create sequence purchase_no start 1;

create table purchase_invoices (
  id uuid primary key default gen_random_uuid(),
  no int not null unique default nextval('purchase_no'),
  supplier_id uuid not null references suppliers (id) on delete restrict,
  supplier_ref text,  -- رقم فاتورة المورد
  day date not null default current_date,
  due_date date,
  currency text not null default 'IQD' check (currency in ('IQD', 'USD')),
  discount numeric(16, 2) not null default 0,
  notes text,
  received_at timestamptz,  -- وقت إدخال المواد للمخزن
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) default auth.uid(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id)
);
create index purchase_invoices_supplier on purchase_invoices (supplier_id);
create trigger purchase_invoices_touch before update on purchase_invoices for each row execute function touch_updated();

create table purchase_lines (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references purchase_invoices (id) on delete cascade,
  position int not null default 0,
  material_id uuid references materials (id) on delete set null,  -- فارغ = خدمة أو مصروف ما يدخل المخزن
  description text not null,
  qty numeric(14, 3) not null default 1,
  unit text,
  unit_price numeric(16, 2) not null default 0
);
create index purchase_lines_inv on purchase_lines (invoice_id);

alter table stock_moves add column purchase_invoice_id uuid references purchase_invoices (id) on delete cascade;

-- ---------- تسديد الموردين ----------
create table supplier_payments (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references suppliers (id) on delete restrict,
  invoice_id uuid references purchase_invoices (id) on delete set null,
  day date not null default current_date,
  amount numeric(16, 2) not null check (amount > 0),
  currency text not null default 'IQD' check (currency in ('IQD', 'USD')),
  method text not null default 'cash' check (method in ('cash', 'transfer', 'cheque')),
  note text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) default auth.uid()
);
create index supplier_payments_supplier on supplier_payments (supplier_id);

-- ---------- سعر المادة: معدل مرجّح عند كل استلام ----------
create or replace function apply_stock_move() returns trigger language plpgsql security definer set search_path = public as $$
declare
  d numeric;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    d := case old.kind when 'issue' then -old.qty else old.qty end;
    update materials set qty = qty - d where id = old.material_id;
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    if tg_op = 'INSERT' and new.kind = 'receive' then
      update materials
        set unit_price = case when qty > 0 then round((qty * unit_price + new.qty * new.unit_price) / (qty + new.qty), 2)
                              else new.unit_price end
        where id = new.material_id;
    end if;
    d := case new.kind when 'issue' then -new.qty else new.qty end;
    update materials set qty = qty + d where id = new.material_id;
    return new;
  end if;
  return old;
end $$;

-- إدخال مواد الفاتورة للمخزن (مرة وحدة). المحاسب ما يقدر يكتب حركات مخزن مباشرة، فالدالة تسويها بصلاحيتها
create function receive_purchase(p_invoice uuid) returns int language plpgsql security definer set search_path = public as $$
declare
  inv purchase_invoices;
  n int;
  rate numeric;
begin
  if not has_role('manager', 'accountant') then
    raise exception 'ليس لديك صلاحية' using errcode = '42501';
  end if;
  select * into inv from purchase_invoices where id = p_invoice for update;
  if inv.id is null then raise exception 'الفاتورة غير موجودة'; end if;
  if inv.received_at is not null then raise exception 'المواد مستلمة من قبل'; end if;
  -- سعر المخزن بعملة المادة؛ إذا اختلفت العملة نحوّل بسعر الصرف بالإعدادات
  select usd_rate into rate from settings where id = 1;
  insert into stock_moves (material_id, kind, qty, unit_price, day, note, purchase_invoice_id)
  select l.material_id, 'receive', l.qty,
         case when m.currency = inv.currency then l.unit_price
              when inv.currency = 'USD' then l.unit_price * coalesce(rate, 1500)
              else round(l.unit_price / coalesce(rate, 1500), 2) end,
         inv.day, 'فاتورة شراء #' || inv.no, inv.id
  from purchase_lines l join materials m on m.id = l.material_id
  where l.invoice_id = inv.id and l.qty > 0;
  get diagnostics n = row_count;
  update purchase_invoices set received_at = now() where id = inv.id;
  update purchase_requests set status = 'bought'
    where status = 'approved' and material_id in (select material_id from purchase_lines where invoice_id = inv.id);
  return n;
end $$;

-- ---------- المجاميع ----------
create view purchase_totals with (security_invoker = true) as
select i.id as invoice_id, i.supplier_id, i.currency,
  coalesce(l.subtotal, 0) as subtotal,
  coalesce(l.subtotal, 0) - i.discount as total,
  coalesce(p.paid, 0) as paid,
  coalesce(l.subtotal, 0) - i.discount - coalesce(p.paid, 0) as balance
from purchase_invoices i
left join lateral (select sum(qty * unit_price) as subtotal from purchase_lines where invoice_id = i.id) l on true
left join lateral (select sum(amount) as paid from supplier_payments where invoice_id = i.id) p on true;

create view supplier_balances with (security_invoker = true) as
with inv as (
  select supplier_id, currency, sum(total) as invoiced from purchase_totals group by 1, 2
), pay as (
  select supplier_id, currency, sum(amount) as paid from supplier_payments group by 1, 2
)
select coalesce(inv.supplier_id, pay.supplier_id) as supplier_id,
  coalesce(inv.currency, pay.currency) as currency,
  coalesce(invoiced, 0) as invoiced, coalesce(paid, 0) as paid,
  coalesce(invoiced, 0) - coalesce(paid, 0) as balance
from inv full join pay on pay.supplier_id = inv.supplier_id and pay.currency = inv.currency;

-- ---------- الصلاحيات ----------
alter table suppliers enable row level security;
alter table purchase_requests enable row level security;
alter table purchase_invoices enable row level security;
alter table purchase_lines enable row level security;
alter table supplier_payments enable row level security;

create policy suppliers_read on suppliers for select using (current_role_name() is not null);
create policy suppliers_write on suppliers for all
  using (has_role('manager', 'accountant', 'storekeeper')) with check (has_role('manager', 'accountant', 'storekeeper'));
-- الطلب: أمين المخزن ومدير الإنتاج يطلبون، والمدير يوافق
create policy purchase_requests_read on purchase_requests for select
  using (has_role('manager', 'accountant', 'storekeeper', 'production'));
create policy purchase_requests_insert on purchase_requests for insert
  with check (has_role('manager', 'accountant', 'storekeeper', 'production'));
create policy purchase_requests_update on purchase_requests for update
  using (has_role('manager', 'accountant') or (created_by = auth.uid() and status = 'pending'))
  with check (has_role('manager', 'accountant') or (created_by = auth.uid() and status = 'pending'));
create policy purchase_requests_delete on purchase_requests for delete
  using (has_role('manager') or (created_by = auth.uid() and status = 'pending'));
create policy purchase_invoices_all on purchase_invoices for all using (has_role('manager', 'accountant')) with check (has_role('manager', 'accountant'));
create policy purchase_lines_all on purchase_lines for all using (has_role('manager', 'accountant')) with check (has_role('manager', 'accountant'));
create policy supplier_payments_all on supplier_payments for all using (has_role('manager', 'accountant')) with check (has_role('manager', 'accountant'));

grant select, insert, update, delete on suppliers, purchase_requests, purchase_invoices, purchase_lines, supplier_payments to authenticated;
grant select on purchase_totals, supplier_balances to authenticated;
grant usage, select on sequence purchase_no to authenticated;
grant execute on function receive_purchase(uuid) to authenticated;

do $$
declare t text;
begin
  foreach t in array array['suppliers', 'purchase_requests', 'purchase_invoices', 'supplier_payments']
  loop
    execute format('create trigger %I_audit after insert or update or delete on %I for each row execute function audit()', t, t);
  end loop;
end $$;
