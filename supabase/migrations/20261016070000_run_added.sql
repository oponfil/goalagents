-- How much an agent added during its current run (or its last one, while it sleeps).
-- run_base: the count it works into (the stage its zone feeds, or the results for the output
-- zone) when the run started; the server keeps run_added = count now - run_base on each report.
-- run_manual: the agent set run_added itself, so reports leave it alone until the next run.
alter table public.presence
  add column run_added integer check (run_added >= 0),
  add column run_base numeric,
  add column run_manual boolean not null default false;
