-- Plans. Free: up to 3 funnels with up to 3 stages each. Pro: any number of funnels with up to
-- 5 stages each (5 is what the dashboard draws). Nobody pays yet: a plan is set by hand
-- (update public.accounts set plan = 'pro' where user_id = …) until payments exist.

create table public.accounts (
  user_id uuid primary key references auth.users (id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'pro')),
  created_at timestamptz not null default now()
);

alter table public.accounts enable row level security;
-- People can see their plan, never change it.
create policy "Own account" on public.accounts for select to authenticated
  using ((select auth.uid()) = user_id);

-- Every person gets an account row when they sign up; existing people get one now.
create function public.create_account() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.accounts (user_id) values (new.id) on conflict do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.create_account();
insert into public.accounts (user_id) select id from auth.users on conflict do nothing;

-- The caller's plan (rows are always written as their owner, so this is the owner's plan).
create function public.my_plan() returns text
language sql stable set search_path = '' as $$
  select coalesce((select plan from public.accounts where user_id = (select auth.uid())), 'free')
$$;

create function public.funnel_limit() returns trigger
language plpgsql set search_path = '' as $$
begin
  if public.my_plan() = 'free' and (
    select count(*) from public.funnels f where f.user_id = new.user_id and f.key <> new.key) >= 3 then
    raise exception 'The free plan has up to 3 funnels. Delete one or upgrade to Pro for more.'
      using errcode = 'check_violation';
  end if;
  return new;
end $$;
create trigger funnels_limit before insert on public.funnels
  for each row execute function public.funnel_limit();

create function public.stage_limit() returns trigger
language plpgsql set search_path = '' as $$
declare
  max_stages int := case public.my_plan() when 'pro' then 5 else 3 end;
begin
  if (select count(*) from public.stages s where s.funnel_id = new.funnel_id and s.key <> new.key) >= max_stages then
    raise exception 'The % plan has up to % stages per funnel.', public.my_plan(), max_stages
      using errcode = 'check_violation';
  end if;
  return new;
end $$;
create trigger stages_limit before insert on public.stages
  for each row execute function public.stage_limit();
