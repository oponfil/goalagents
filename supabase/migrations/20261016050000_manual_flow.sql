-- Optional manual flow (items per day) an agent can set instead of the one computed from its
-- reports (null = automatic). stages.flow_per_day: the zone that feeds this stage;
-- funnels.output_flow_per_day: results per day below the last stage.

alter table public.stages add column flow_per_day numeric check (flow_per_day >= 0);
alter table public.funnels add column output_flow_per_day numeric check (output_flow_per_day >= 0);
