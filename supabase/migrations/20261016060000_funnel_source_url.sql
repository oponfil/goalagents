-- One link per funnel: the list its items live in (usually one sheet with a status column).
-- Stage links are no longer used; a stage link already set becomes the funnel's when it has none.

alter table public.funnels add column source_url text check (source_url ~ '^https?://');

update public.funnels f set source_url = (
  select s.source_url from public.stages s
  where s.funnel_id = f.id and s.source_url is not null order by s.position limit 1)
where f.source_url is null;
