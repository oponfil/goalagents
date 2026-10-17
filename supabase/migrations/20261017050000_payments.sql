-- Payments through Creem (merchant of record). Pro is $9 a month (early-access price; $15 later).
-- A plan is Pro while plan = 'pro' and pro_until is unset or still ahead: paid months move
-- pro_until forward (supabase/functions/billing), and the people who signed up during the free
-- launch keep Pro until the end of 2026. New people start on the free plan.

alter table public.accounts
  add column pro_until timestamptz,
  add column creem_customer_id text,
  add column creem_subscription_id text,
  add column subscription_status text;

alter table public.accounts alter column plan set default 'free';
update public.accounts set plan = 'pro', pro_until = '2027-01-01T00:00:00Z';

create or replace function public.my_plan() returns text
language sql stable set search_path = '' as $$
  select coalesce((
    select case when a.plan = 'pro' and (a.pro_until is null or a.pro_until > now()) then 'pro' else 'free' end
    from public.accounts a where a.user_id = (select auth.uid())
  ), 'free')
$$;
