-- Three more looks: forge (smiths at an anvil), bakery (bakers rolling dough), blocks (block-headed
-- heroes fighting a slime).
alter table public.funnels drop constraint funnels_theme_check;
alter table public.funnels add constraint funnels_theme_check
  check (theme in ('mine', 'lab', 'garden', 'love', 'code', 'money', 'forge', 'bakery', 'blocks'));
