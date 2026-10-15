-- Pro has up to 10 funnels (5 stages each). Pro costs $10 a month, free during the launch:
-- everyone, new and existing, is on Pro until payments exist. To end the launch offer, set the
-- default back to 'free' and move people as they pay.

alter table public.accounts alter column plan set default 'pro';
update public.accounts set plan = 'pro' where plan = 'free';

create or replace function public.my_plan() returns text
language sql stable set search_path = '' as $$
  select coalesce((select plan from public.accounts where user_id = (select auth.uid())), 'pro')
$$;

create or replace function public.funnel_limit() returns trigger
language plpgsql set search_path = '' as $$
declare
  max_funnels int := case public.my_plan() when 'pro' then 10 else 3 end;
begin
  if (select count(*) from public.funnels f where f.user_id = new.user_id and f.key <> new.key) >= max_funnels then
    raise exception 'The % plan has up to % funnels. Delete one to add another.', public.my_plan(), max_funnels
      using errcode = 'check_violation';
  end if;
  return new;
end $$;
