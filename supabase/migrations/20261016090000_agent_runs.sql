-- Each agent's runs, for the history in its card on the dashboard: when it started and ended, the
-- zone it worked and what it added. A run starts when the agent comes to work from sleep (or to
-- another zone) and ends when it goes to sleep or leaves; the server keeps `added` current from
-- the agent's reports, as it does presence.run_added. Agents themselves only see it through the
-- server; the person reads it.
create table public.agent_runs (
  id bigint generated always as identity primary key,
  funnel_id uuid not null references public.funnels (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  agent text not null,
  zone smallint not null check (zone between 0 and 5),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  added integer not null default 0 check (added >= 0)
);
create index agent_runs_agent on public.agent_runs (funnel_id, agent, started_at desc);

create trigger agent_runs_owner before insert or update on public.agent_runs
  for each row execute function public.same_owner();

alter table public.agent_runs enable row level security;
create policy "Own runs" on public.agent_runs for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
