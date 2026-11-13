-- Reports of offensive or harmful AI replies, made from inside the app.
--
-- Google Play requires apps with generative AI to let people flag offensive
-- output without leaving the app. Octi's "Report" button inserts a row here;
-- the developer reads them in the Supabase dashboard (service role). Users can
-- only add their own reports and can't read anyone's, including their own.
-- Safe to re-run.

create table if not exists public.content_reports (
  id         bigint generated always as identity primary key,
  reporter   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind       text not null check (kind in ('octi')),
  -- The reply being reported and the message that prompted it, so the report
  -- can be judged without access to the reporter's data.
  content    text not null check (char_length(content) <= 8000),
  context    text check (context is null or char_length(context) <= 4000),
  created_at timestamptz not null default now()
);

alter table public.content_reports enable row level security;

drop policy if exists "content_reports: add own" on public.content_reports;
create policy "content_reports: add own" on public.content_reports for insert to authenticated
  with check (reporter = auth.uid());
