-- One row per account, holding that account's whole app state as JSON.
--
-- The client already keeps everything in a single reducer object and writes it
-- to localStorage as one blob, so storing it as one blob here means the sync
-- layer is a read and a write rather than a table-per-entity mapping.
--
-- ponytail: whole-document last-write-wins. Two devices editing at the same
-- moment means the later write wins entirely and the other device's edits in
-- that window are lost. Split into per-entity tables if that starts happening
-- in practice — the client would then merge per row instead of per document.

create table if not exists public.user_state (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb       not null default '{}'::jsonb,
  -- Client clock, milliseconds. The client compares this against the revision
  -- it last saw to tell "someone else changed this" from "this is my own echo".
  rev        bigint      not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.user_state enable row level security;

-- The security boundary. Without this every signed-in user could read every
-- other user's row with the public anon key.
create policy "own state: read"   on public.user_state for select using (auth.uid() = user_id);
create policy "own state: insert" on public.user_state for insert with check (auth.uid() = user_id);
create policy "own state: update" on public.user_state for update using (auth.uid() = user_id)
                                                              with check (auth.uid() = user_id);
create policy "own state: delete" on public.user_state for delete using (auth.uid() = user_id);

-- Lets other signed-in devices hear about a change without polling.
alter publication supabase_realtime add table public.user_state;
