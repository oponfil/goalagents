-- The chat a question was asked from, so the dashboard's "Open" under each question leads to that
-- very conversation (agents in several chats ask from each).
alter table public.questions add column chat_url text check (chat_url ~ '^https?://');
