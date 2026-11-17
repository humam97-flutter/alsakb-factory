-- الدفعة الرابعة: الحسابات (المصاريف، الصندوق، تقرير الربح الشهري)
-- يشغَّل مرة واحدة من SQL Editor بعد 0006

-- ---------- المصاريف العامة ----------
create table expenses (
  id uuid primary key default gen_random_uuid(),
  day date not null default current_date,
  category text not null,
  amount numeric(16, 2) not null check (amount > 0),
  currency text not null default 'IQD' check (currency in ('IQD', 'USD')),
  method text not null default 'cash' check (method in ('cash', 'transfer', 'cheque')),
  note text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) default auth.uid()
);
create index expenses_day on expenses (day);

-- ---------- حركات صندوق يدوية: رصيد افتتاحي، إيداع، سحب، تصريف عملة ----------
create table cash_entries (
  id uuid primary key default gen_random_uuid(),
  day date not null default current_date,
  kind text not null check (kind in ('opening', 'deposit', 'withdraw', 'exchange')),
  amount numeric(16, 2) not null check (amount <> 0),  -- موجب داخل، سالب طالع
  currency text not null check (currency in ('IQD', 'USD')),
  pair_id uuid,  -- التصريف ينسجل حركتين مربوطة
  note text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) default auth.uid()
);
create index cash_entries_day on cash_entries (day);

-- ---------- دفتر الصندوق: كل فلس داخل وطالع ----------
create view cash_ledger with (security_invoker = true) as
select 'customer' as source, p.id, p.day, p.amount as amount, p.currency, p.method,
       'قبض من ' || c.name as description, p.created_at
from customer_payments p join customers c on c.id = p.customer_id
union all
select 'supplier', p.id, p.day, -p.amount, p.currency, p.method, 'تسديد إلى ' || s.name, p.created_at
from supplier_payments p join suppliers s on s.id = p.supplier_id
union all
select 'worker', p.id, p.day, -p.amount, p.currency, 'cash',
       case p.kind when 'advance' then 'سلفة: ' else 'راتب: ' end || w.full_name, p.updated_at
from worker_payments p join workers w on w.id = p.worker_id
where p.kind in ('advance', 'salary')
union all
select 'expense', e.id, e.day, -e.amount, e.currency, e.method, e.category || coalesce(': ' || e.note, ''), e.created_at
from expenses e
union all
select 'entry', x.id, x.day, x.amount, x.currency, 'cash',
       case x.kind when 'opening' then 'رصيد افتتاحي' when 'deposit' then 'إيداع' when 'withdraw' then 'سحب'
                   else 'تصريف عملة' end || coalesce(': ' || x.note, ''), x.created_at
from cash_entries x;

-- ---------- تقرير الشهر: كل الأرقام بالعملتين ----------
-- الإيراد = الفواتير، والكلفة = المواد المصروفة + الأجور + المصاريف + الصيانة + مصاريف فواتير الشراء
create view monthly_pnl with (security_invoker = true) as
with m as (
  select date_trunc('month', i.day)::date as month, i.currency, sum(t.total) as revenue, 0::numeric as materials, 0::numeric as wages,
         0::numeric as expenses, 0::numeric as maintenance, 0::numeric as services
  from invoices i join invoice_totals t on t.invoice_id = i.id where not i.cancelled group by 1, 2
  union all
  select date_trunc('month', s.day)::date, mt.currency, 0, sum(s.qty * s.unit_price), 0, 0, 0, 0
  from stock_moves s join materials mt on mt.id = s.material_id where s.kind = 'issue' group by 1, 2
  union all
  select month, currency, 0, 0, sum(earned + bonus - deduction), 0, 0, 0 from monthly_payroll group by 1, 2
  union all
  select date_trunc('month', day)::date, currency, 0, 0, 0, sum(amount), 0, 0 from expenses group by 1, 2
  union all
  select date_trunc('month', day)::date, 'IQD', 0, 0, 0, 0, sum(cost), 0 from maintenance where cost is not null group by 1, 2
  union all
  select date_trunc('month', i.day)::date, i.currency, 0, 0, 0, 0, 0, sum(l.qty * l.unit_price)
  from purchase_lines l join purchase_invoices i on i.id = l.invoice_id where l.material_id is null group by 1, 2
)
select month, currency,
  sum(revenue) as revenue, sum(materials) as materials, sum(wages) as wages,
  sum(expenses) as expenses, sum(maintenance) as maintenance, sum(services) as services,
  sum(revenue) - sum(materials) - sum(wages) - sum(expenses) - sum(maintenance) - sum(services) as profit
from m group by month, currency;

-- ---------- الصلاحيات ----------
alter table expenses enable row level security;
alter table cash_entries enable row level security;
create policy expenses_all on expenses for all using (has_role('manager', 'accountant')) with check (has_role('manager', 'accountant'));
create policy cash_entries_all on cash_entries for all using (has_role('manager', 'accountant')) with check (has_role('manager', 'accountant'));
grant select, insert, update, delete on expenses, cash_entries to authenticated;
grant select on cash_ledger, monthly_pnl to authenticated;

do $$
declare t text;
begin
  foreach t in array array['expenses', 'cash_entries']
  loop
    execute format('create trigger %I_audit after insert or update or delete on %I for each row execute function audit()', t, t);
  end loop;
end $$;
