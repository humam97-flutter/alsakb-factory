-- الدفعة السادسة: العمال (حضور بالـ QR، الإجازات، الإنتاجية)
-- يشغَّل مرة واحدة من SQL Editor بعد 0008

-- وقت الدخول والخروج لكل يوم
alter table attendance add column check_in timestamptz;
alter table attendance add column check_out timestamptz;

-- ساعات الدوام الاعتيادي، وما زاد عليها يصير ساعات إضافية
alter table settings add column shift_hours numeric(4, 2) not null default 8;
-- رصيد الإجازات السنوي لكل عامل
alter table workers add column leave_days int not null default 12;

-- تسجيل دخول أو خروج العامل بمسح بطاقته. أول مسح باليوم دخول، والثاني خروج ويحسب الإضافي
create function scan_attendance(p_worker uuid) returns text
language plpgsql security definer set search_path = public as $$
declare
  a attendance;
  shift numeric;
  worked numeric;
  t date := (now() at time zone 'Asia/Baghdad')::date;
begin
  if not has_role('manager', 'production', 'accountant') then
    raise exception 'ليس لديك صلاحية' using errcode = '42501';
  end if;
  select * into a from attendance where worker_id = p_worker and day = t for update;
  if a.worker_id is null or a.check_in is null then
    insert into attendance (worker_id, day, status, check_in) values (p_worker, t, 'present', now())
    on conflict (worker_id, day) do update set status = 'present', check_in = now();
    return 'in';
  end if;
  select shift_hours into shift from settings where id = 1;
  worked := extract(epoch from (now() - a.check_in)) / 3600;
  update attendance
    set check_out = now(),
        overtime_hours = greatest(0, round((worked - coalesce(shift, 8)) * 4) / 4),  -- لأقرب ربع ساعة
        status = case when worked < coalesce(shift, 8) / 2 then 'half'::attendance_status else 'present'::attendance_status end
    where worker_id = p_worker and day = t;
  return 'out';
end $$;
grant execute on function scan_attendance(uuid) to authenticated;

-- إنتاجية العامل بالشهر: المراحل اللي نفذها وساعاتها
create view worker_productivity with (security_invoker = true) as
select s.worker_id, date_trunc('month', s.done_at at time zone 'Asia/Baghdad')::date as month,
  count(*) as stages_done,
  coalesce(sum(s.hours), 0) as hours,
  count(distinct s.order_id) as orders
from work_order_stages s
where s.status = 'done' and s.worker_id is not null and s.done_at is not null
group by 1, 2;
grant select on worker_productivity to authenticated;
