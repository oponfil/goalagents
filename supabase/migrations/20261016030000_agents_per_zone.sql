-- Agents per zone by plan: Free has one place at each zone, Pro two (left and right of the pipe).

create or replace function public.presence_zone_limit() returns trigger
language plpgsql set search_path = '' as $$
declare
  max_agents int := case public.my_plan() when 'pro' then 2 else 1 end;
begin
  if (select count(*) from public.presence p
      where p.funnel_id = new.funnel_id and p.zone = new.zone and p.agent <> new.agent) >= max_agents then
    raise exception 'Zone % is full: the % plan has % agent(s) per zone.', new.zone, public.my_plan(), max_agents
      using errcode = 'check_violation';
  end if;
  new.updated_at := now();
  return new;
end $$;
