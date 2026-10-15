-- Optional manual readings an agent can set instead of the computed ones (null = automatic).
-- stages.fill_percent: how full the tank is, 0-100 % of what this stage needs for the goal.
-- stages.pace: the gauge of the zone that feeds this stage; funnels.output_pace: the gauge below
-- the last stage. Pace is against the goal: 1 is on the red mark (just in time), 0.5 half the
-- pace needed, 2 twice it.

alter table public.stages
  add column fill_percent numeric check (fill_percent between 0 and 100),
  add column pace numeric check (pace >= 0);

alter table public.funnels
  add column output_pace numeric check (output_pace >= 0);
