-- Security hardening found in an audit.

-- ── Friendships: accepting may only change `status` ─────────────────────────
-- The "accept" policy in 0002 lets the addressee update the whole row, so they
-- could rewrite `requester` to any user id (every id is readable in profiles)
-- and mint an accepted friendship with someone who never agreed, then send
-- them shares. Column-level grants close it; RLS still decides which rows.
revoke update on public.friendships from authenticated;
grant update (status) on public.friendships to authenticated;

-- ── Profiles: bounded name, avatar must be your own uploaded picture ────────
-- avatar_url was free text, so anyone could point theirs at a server they own
-- and log the IP of every friend whose screen shows it.
-- ponytail: assumes the default *.supabase.co host; loosen the regex if the
-- project moves to a custom domain.
-- Dropped first so the file can be re-run safely.
alter table public.profiles
  drop constraint if exists profiles_name_len,
  drop constraint if exists profiles_avatar_own,
  add constraint profiles_name_len check (char_length(name) <= 60) not valid,
  add constraint profiles_avatar_own check (
    avatar_url is null or avatar_url ~ (
      '^https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/avatars/'
      || user_id::text || '/avatar\.webp(\?v=[0-9]+)?$'
    )
  ) not valid;

-- ── Backend: count active users ─────────────────────────────────────────────
-- The AI route splits the daily token quota across users who synced in the
-- last 7 days, counted from user_state.updated_at. Newer projects don't grant
-- the service role access to SQL-made tables, so without this the count fails
-- and every user is handed the whole quota. Read-only on purpose.
grant select on public.user_state to service_role;

-- ── user_state: cap the blob ────────────────────────────────────────────────
-- The client mirrors localStorage (~5 MB), so nothing honest is larger. Stops
-- one account filling the database.
alter table public.user_state
  drop constraint if exists user_state_size,
  add constraint user_state_size check (octet_length(data::text) < 5000000) not valid;
