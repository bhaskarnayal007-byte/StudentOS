-- Indexes for the lookups the social tables do on every call.
--
-- The RLS policies in 0002 filter with `auth.uid() in (requester, addressee)`
-- and `auth.uid() in (sender, recipient)`. Postgres can only answer that from
-- one index per column (a bitmap OR); the friendships_pair index starts with
-- least(...), so it doesn't help. Without these, every friends list and inbox
-- read scans the whole table, and deleting an account scans it again for the
-- `on delete cascade` foreign keys.

create index if not exists friendships_requester on public.friendships (requester);
create index if not exists friendships_addressee on public.friendships (addressee);

create index if not exists shares_sender on public.shares (sender);
-- The inbox: newest first for one recipient (lib/social.js inbox()).
create index if not exists shares_recipient on public.shares (recipient, created_at desc);

-- Same cascade reason as above; messages are already indexed by chat.
create index if not exists messages_sender on public.messages (sender);
