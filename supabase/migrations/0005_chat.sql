-- Chats: one-to-one and group text messages between friends.
--
-- Conversations are only ever created through start_chat / create_group, which
-- check friendship first; there is no insert policy on conversations or
-- members, so the browser can't put anyone into a chat directly. Membership is
-- the access rule for everything else. Safe to re-run.

-- ── Tables ──────────────────────────────────────────────────────────────────
create table if not exists public.conversations (
  id              uuid primary key default gen_random_uuid(),
  is_group        boolean not null default false,
  title           text check (title is null or char_length(title) between 1 and 60),
  -- "<smaller id>:<larger id>" for one-to-one chats, so a pair has exactly one.
  dm_key          text unique,
  created_by      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at      timestamptz not null default now(),
  last_message_at timestamptz
);

create table if not exists public.conversation_members (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id         uuid not null references auth.users (id) on delete cascade,
  joined_at       timestamptz not null default now(),
  last_read_at    timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
create index if not exists conversation_members_user on public.conversation_members (user_id);

create table if not exists public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  body            text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at      timestamptz not null default now()
);
create index if not exists messages_by_chat on public.messages (conversation_id, created_at desc);

alter table public.conversations        enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages             enable row level security;

-- ── Helpers ─────────────────────────────────────────────────────────────────
-- security definer so policies can ask "am I a member?" without the policy on
-- conversation_members recursing into itself.
create or replace function public.is_member(conv uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from conversation_members
    where conversation_id = conv and user_id = auth.uid()
  );
$$;

-- The accepted-friendship test from the "shares: send" policy in 0002.
create or replace function public.are_friends(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from friendships f
    where f.status = 'accepted'
      and least(f.requester, f.addressee) = least(a, b)
      and greatest(f.requester, f.addressee) = greatest(a, b)
  );
$$;

-- Members can post in groups; in a one-to-one chat only while still friends.
create or replace function public.can_post(conv uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_member(conv) and exists (
    select 1 from conversations c
    where c.id = conv and (
      c.is_group or exists (
        select 1 from conversation_members m
        where m.conversation_id = conv
          and m.user_id <> auth.uid()
          and public.are_friends(auth.uid(), m.user_id)
      )
    )
  );
$$;

-- ── Starting chats ──────────────────────────────────────────────────────────
-- The one-to-one chat with a friend: the existing one, or a new one.
create or replace function public.start_chat(friend uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  me  uuid := auth.uid();
  key text;
  conv uuid;
begin
  if me is null then raise exception 'Sign in first.'; end if;
  if not public.are_friends(me, friend) then raise exception 'You can only chat with friends.'; end if;

  key := least(me, friend)::text || ':' || greatest(me, friend)::text;
  insert into conversations (is_group, dm_key, created_by)
  values (false, key, me)
  on conflict (dm_key) do nothing
  returning id into conv;

  if conv is null then
    select id into conv from conversations where dm_key = key;
  else
    insert into conversation_members (conversation_id, user_id)
    values (conv, me), (conv, friend);
  end if;
  return conv;
end;
$$;

-- A group of you plus 2–30 of your friends.
create or replace function public.create_group(title text, members uuid[]) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  me     uuid := auth.uid();
  name   text := btrim(coalesce(title, ''));
  others uuid[];
  conv   uuid;
begin
  if me is null then raise exception 'Sign in first.'; end if;
  if char_length(name) not between 1 and 60 then raise exception 'Give the group a name (up to 60 characters).'; end if;

  select coalesce(array_agg(distinct m), '{}') into others
  from unnest(members) m where m is not null and m <> me;

  if cardinality(others) not between 2 and 30 then
    raise exception 'Pick between 2 and 30 friends.';
  end if;
  if exists (select 1 from unnest(others) m where not public.are_friends(me, m)) then
    raise exception 'Everyone in a group must be your friend.';
  end if;

  insert into conversations (is_group, title, created_by) values (true, name, me) returning id into conv;
  insert into conversation_members (conversation_id, user_id)
  select conv, u from unnest(others || me) u;
  return conv;
end;
$$;

-- ── The chat list ───────────────────────────────────────────────────────────
-- security invoker: runs with the caller's rights, so RLS decides what it sees.
create or replace function public.my_chats()
returns table (
  id uuid, is_group boolean, title text, created_at timestamptz, last_message_at timestamptz,
  last_body text, last_sender uuid, unread int, can_post boolean, members jsonb
)
language sql stable security invoker set search_path = public as $$
  select c.id, c.is_group, c.title, c.created_at, c.last_message_at,
         lm.body, lm.sender,
         (select count(*) from messages m
           where m.conversation_id = c.id and m.sender <> auth.uid()
             and m.created_at > mine.last_read_at)::int,
         public.can_post(c.id),
         (select coalesce(jsonb_agg(jsonb_build_object(
                   'user_id', cm.user_id, 'tag', p.tag, 'name', p.name, 'avatar_url', p.avatar_url)), '[]'::jsonb)
            from conversation_members cm
            left join profiles p on p.user_id = cm.user_id
           where cm.conversation_id = c.id)
  from conversation_members mine
  join conversations c on c.id = mine.conversation_id
  left join lateral (
    select body, sender from messages m
    where m.conversation_id = c.id order by m.created_at desc limit 1
  ) lm on true
  where mine.user_id = auth.uid()
  order by coalesce(c.last_message_at, c.created_at) desc;
$$;

-- Keeps the list ordered by latest activity.
create or replace function public.touch_conversation() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update conversations set last_message_at = new.created_at where id = new.conversation_id;
  return new;
end;
$$;
drop trigger if exists messages_touch on public.messages;
create trigger messages_touch after insert on public.messages
  for each row execute function public.touch_conversation();

-- ── Policies ────────────────────────────────────────────────────────────────
drop policy if exists "conversations: read" on public.conversations;
create policy "conversations: read" on public.conversations for select
  using (public.is_member(id));

drop policy if exists "members: read" on public.conversation_members;
create policy "members: read" on public.conversation_members for select
  using (public.is_member(conversation_id));

-- Only your own row, and the column grant below limits it to last_read_at.
drop policy if exists "members: mark read" on public.conversation_members;
create policy "members: mark read" on public.conversation_members for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Leaving: groups only. Leaving a one-to-one would just hide it from yourself.
drop policy if exists "members: leave group" on public.conversation_members;
create policy "members: leave group" on public.conversation_members for delete
  using (user_id = auth.uid()
         and (select c.is_group from public.conversations c where c.id = conversation_id));

drop policy if exists "messages: read" on public.messages;
create policy "messages: read" on public.messages for select
  using (public.is_member(conversation_id));

drop policy if exists "messages: send" on public.messages;
create policy "messages: send" on public.messages for insert
  with check (sender = auth.uid() and public.can_post(conversation_id));

-- ── Grants ──────────────────────────────────────────────────────────────────
-- Older projects grant everything on new tables to anon/authenticated. Start
-- from nothing, or a member could rewrite their row's conversation_id and read
-- any chat.
revoke all on public.conversations, public.conversation_members, public.messages from anon, authenticated;
grant select on public.conversations to authenticated;
grant select, delete on public.conversation_members to authenticated;
grant update (last_read_at) on public.conversation_members to authenticated;
grant select, insert on public.messages to authenticated;

revoke execute on function public.is_member(uuid), public.are_friends(uuid, uuid), public.can_post(uuid),
  public.start_chat(uuid), public.create_group(text, uuid[]), public.my_chats(),
  public.touch_conversation() from public, anon;
grant execute on function public.is_member(uuid), public.are_friends(uuid, uuid), public.can_post(uuid),
  public.start_chat(uuid), public.create_group(text, uuid[]), public.my_chats() to authenticated;

-- ── Realtime ────────────────────────────────────────────────────────────────
-- New messages, and being added to (or leaving) a chat. RLS filters delivery.
do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and tablename = 'messages') then
    alter publication supabase_realtime add table public.messages;
  end if;
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and tablename = 'conversation_members') then
    alter publication supabase_realtime add table public.conversation_members;
  end if;
end $$;
