-- GoalAgents data: funnels, their stages, the count history the flows are computed from,
-- agent presence, and the questions agents ask the person. Everything belongs to one user.
-- The MCP server and the dashboard both act as that user, so row-level security alone keeps
-- each person's data private; neither ever uses a service key.

create table public.funnels (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  key text not null check (key ~ '^[a-z0-9][a-z0-9-]{0,63}$'),
  title text not null check (length(title) between 1 and 60),
  theme text not null default 'mine' check (theme in ('mine', 'lab', 'forge', 'love', 'code', 'money')),
  -- Name of one result: [singular, plural] or the three Russian forms [1, 2-4, 5+].
  result text[] not null check (cardinality(result) in (2, 3)),
  goal_total integer check (goal_total > 0),
  goal_every_days numeric check (goal_every_days > 0),
  results integer not null default 0 check (results >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, key)
);

create table public.stages (
  funnel_id uuid not null references public.funnels (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  key text not null check (key ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
  position smallint not null check (position between 0 and 4),
  label text[] not null check (cardinality(label) in (2, 3)),
  count bigint not null default 0 check (count >= 0),
  source_url text check (source_url ~ '^https?://'),
  primary key (funnel_id, key),
  unique (funnel_id, position) deferrable initially deferred
);

-- One row per reported value: a stage count (stage_key) or the results so far (stage_key null).
-- Flows on the gauges are the growth of these values over time.
create table public.count_reports (
  id bigint generated always as identity primary key,
  funnel_id uuid not null references public.funnels (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  stage_key text,
  value bigint not null check (value >= 0),
  at timestamptz not null default now()
);
create index count_reports_funnel_at on public.count_reports (funnel_id, at);

-- Where each agent stands and what it is doing. One presence per agent per funnel.
-- Zone 0 is the inflow above the first stage, zone k moves stage k-1 into stage k,
-- zone n (below the last stage) turns the last stage into results.
create table public.presence (
  funnel_id uuid not null references public.funnels (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  agent text not null check (agent ~ '^[a-z0-9][a-z0-9_-]{0,31}$'),
  zone smallint not null check (zone between 0 and 5),
  state text not null check (state in ('work', 'sleep', 'ask')),
  next_run_at timestamptz,
  question_id uuid,
  chat_url text check (chat_url ~ '^https?://'),
  updated_at timestamptz not null default now(),
  primary key (funnel_id, agent)
);

-- What an agent asked and what the person answered on the dashboard.
create table public.questions (
  id uuid primary key default gen_random_uuid(),
  funnel_id uuid not null references public.funnels (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  agent text not null,
  question text not null check (length(question) between 1 and 1000),
  answer text check (length(answer) <= 2000),
  asked_at timestamptz not null default now(),
  answered_at timestamptz
);
create index questions_funnel on public.questions (funnel_id, asked_at desc);

alter table public.presence
  add constraint presence_question_fk foreign key (question_id) references public.questions (id) on delete set null;

-- A zone has two places, left and right of the pipe.
create function public.presence_zone_limit() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (select count(*) from public.presence p
      where p.funnel_id = new.funnel_id and p.zone = new.zone and p.agent <> new.agent) >= 2 then
    raise exception 'Zone % already has two agents', new.zone using errcode = 'check_violation';
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger presence_zone_limit before insert or update on public.presence
  for each row execute function public.presence_zone_limit();

create function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;
create trigger funnels_touch before update on public.funnels
  for each row execute function public.touch_updated_at();

-- Child rows must belong to the same user as their funnel.
create function public.same_owner() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not exists (select 1 from public.funnels f where f.id = new.funnel_id and f.user_id = new.user_id) then
    raise exception 'Funnel not found' using errcode = 'foreign_key_violation';
  end if;
  return new;
end $$;
create trigger stages_owner before insert or update on public.stages for each row execute function public.same_owner();
create trigger reports_owner before insert or update on public.count_reports for each row execute function public.same_owner();
create trigger presence_owner before insert or update on public.presence for each row execute function public.same_owner();
create trigger questions_owner before insert or update on public.questions for each row execute function public.same_owner();

alter table public.funnels enable row level security;
alter table public.stages enable row level security;
alter table public.count_reports enable row level security;
alter table public.presence enable row level security;
alter table public.questions enable row level security;

create policy "Own funnels" on public.funnels for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Own stages" on public.stages for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Own reports" on public.count_reports for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Own presence" on public.presence for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Own questions" on public.questions for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- The dashboard redraws when agents write.
alter publication supabase_realtime add table public.funnels, public.stages, public.presence, public.questions;
