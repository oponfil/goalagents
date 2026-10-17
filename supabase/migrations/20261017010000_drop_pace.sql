-- The gauges are gone, and with them the manual pace an agent could set: the dashboard computes the
-- results' pace itself. Apply only once the site no longer reads these columns.
alter table public.stages drop column pace;
alter table public.funnels drop column output_pace;
