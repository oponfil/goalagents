-- The forge theme (smiths) became the garden theme (gardeners): funnels on forge move to garden.
alter table public.funnels drop constraint funnels_theme_check;
update public.funnels set theme = 'garden' where theme = 'forge';
alter table public.funnels add constraint funnels_theme_check
  check (theme in ('mine', 'lab', 'garden', 'love', 'code', 'money'));
