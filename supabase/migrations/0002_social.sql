-- Friends and sharing.
--
-- Everyone picks a public tag (profiles). Two people become friends by one
-- requesting and the other accepting (friendships). A friend can then drop a
-- COPY of a note, event or mind map into the other's inbox (shares); the
-- recipient adds it to their own state and the row is deleted. Nothing here is
-- live-shared: each account's real data stays in its own user_state row.

-- ── Profiles ────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  tag     text not null unique check (tag ~ '^[a-z0-9_]{3,20}$'),
  name    text not null default ''
);

alter table public.profiles enable row level security;

-- Public to signed-in users: finding a friend by tag needs to read other rows.
-- Only the tag and a display name live here, nothing private.
create policy "profiles: read"   on public.profiles for select to authenticated using (true);
create policy "profiles: insert" on public.profiles for insert with check (auth.uid() = user_id);
create policy "profiles: update" on public.profiles for update using (auth.uid() = user_id)
                                                           with check (auth.uid() = user_id);

-- ── Friendships ─────────────────────────────────────────────────────────────
create table if not exists public.friendships (
  id         uuid primary key default gen_random_uuid(),
  requester  uuid not null references auth.users (id) on delete cascade,
  addressee  uuid not null references auth.users (id) on delete cascade,
  status     text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  check (requester <> addressee)
);

-- One row per pair, whichever of the two asked first.
create unique index if not exists friendships_pair
  on public.friendships (least(requester, addressee), greatest(requester, addressee));

alter table public.friendships enable row level security;

create policy "friendships: read" on public.friendships for select
  using (auth.uid() in (requester, addressee));
-- You can only ask on your own behalf, and a request starts unaccepted.
create policy "friendships: request" on public.friendships for insert
  with check (auth.uid() = requester and status = 'pending');
-- Only the person asked can accept.
create policy "friendships: accept" on public.friendships for update
  using (auth.uid() = addressee) with check (auth.uid() = addressee and status = 'accepted');
-- Either side can decline, cancel or unfriend.
create policy "friendships: remove" on public.friendships for delete
  using (auth.uid() in (requester, addressee));

-- ── Shares ──────────────────────────────────────────────────────────────────
create table if not exists public.shares (
  id         uuid primary key default gen_random_uuid(),
  sender     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  recipient  uuid not null references auth.users (id) on delete cascade,
  kind       text not null check (kind in ('note', 'event', 'map')),
  payload    jsonb not null check (octet_length(payload::text) < 200000),
  created_at timestamptz not null default now()
);

alter table public.shares enable row level security;

-- The security boundary for sharing: only to an accepted friend, only as yourself.
create policy "shares: send" on public.shares for insert with check (
  auth.uid() = sender and exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and least(f.requester, f.addressee) = least(sender, recipient)
      and greatest(f.requester, f.addressee) = greatest(sender, recipient)
  )
);
create policy "shares: read" on public.shares for select
  using (auth.uid() in (sender, recipient));
create policy "shares: remove" on public.shares for delete
  using (auth.uid() in (sender, recipient));

-- Table access for signed-in users. Newer Supabase projects no longer grant
-- this automatically to tables made in SQL; without it every call fails with
-- "permission denied for table …" before RLS is even consulted.
-- RLS above still decides which rows each person can touch.
grant select, insert, update on public.profiles    to authenticated;
grant select, insert, update, delete on public.friendships to authenticated;
grant select, insert, delete on public.shares      to authenticated;

-- The inbox and friend requests update without a reload.
alter publication supabase_realtime add table public.friendships, public.shares;
