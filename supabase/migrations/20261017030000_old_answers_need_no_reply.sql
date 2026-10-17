-- Answers given before agents replied to them need no reply now: mark them as replied (with no text)
-- and seen, so agents do not go back over old ones.
update public.questions set replied_at = now(), reply_seen_at = now() where answered_at is not null and replied_at is null;
