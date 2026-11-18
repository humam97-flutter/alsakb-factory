-- المرحلة السابعة: أسعار الحديد، سجل استخدام الذكاء الاصطناعي، وإعدادات تقرير تيليكرام

-- ---------- أسعار الحديد بالسوق ----------
create table steel_prices (
  id uuid primary key default gen_random_uuid(),
  day date not null default current_date,
  item text not null default 'صاج أسود',        -- صاج أسود، صاج مغلون، حديد تسليح، مقاطع، أنابيب...
  grade text,                                    -- A36، ST37، SS304 ...
  thickness text,                                -- مثلاً 3-12 ملم
  price_ton numeric(14, 2) not null check (price_ton > 0),
  currency text not null default 'USD' check (currency in ('IQD', 'USD')),
  source text,                                   -- المورد أو السوق أو البورصة
  note text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) default auth.uid()
);
create index steel_prices_day on steel_prices (item, day desc);

-- ---------- سجل استخدام الذكاء الاصطناعي (للكلفة والمراجعة) ----------
create table ai_log (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('ask', 'scan', 'report')),
  question text,
  input_tokens int not null default 0,
  output_tokens int not null default 0,
  model text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) default auth.uid()
);
create index ai_log_day on ai_log (created_at desc);

-- ---------- إعدادات التقرير اليومي ----------
alter table settings add column telegram_chat_id text;            -- رقم المحادثة أو المجموعة
alter table settings add column report_enabled boolean not null default false;
alter table settings add column ai_enabled boolean not null default true;
alter table settings add column ai_monthly_limit int not null default 2000;  -- حد الأسئلة بالشهر

-- ---------- الصلاحيات ----------
alter table steel_prices enable row level security;
alter table ai_log enable row level security;
create policy steel_prices_read on steel_prices for select using (current_role_name() is not null);
create policy steel_prices_write on steel_prices for all
  using (has_role('manager', 'accountant', 'storekeeper')) with check (has_role('manager', 'accountant', 'storekeeper'));
create policy ai_log_read on ai_log for select using (has_role('manager') or created_by = auth.uid());
create policy ai_log_insert on ai_log for insert with check (created_by = auth.uid());
grant select, insert, update, delete on steel_prices to authenticated;
grant select, insert on ai_log to authenticated;

create trigger steel_prices_audit after insert or update or delete on steel_prices for each row execute function audit();
