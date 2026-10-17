-- After the person answers, the agent replies in a line ("Thanks, sending it now"): the dashboard
-- shows it in a bubble until the person closes it (reply_seen_at).
alter table public.questions
  add column reply text check (length(reply) between 1 and 300),
  add column replied_at timestamptz,
  add column reply_seen_at timestamptz;
