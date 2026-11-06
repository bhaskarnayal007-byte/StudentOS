-- Rate-limit and token-budget counters for the AI route.
--
-- On Render these lived in the Express process's memory. A Cloudflare Worker
-- has no memory that lasts or is shared between requests, so they live here:
-- one row per counter, bumped atomically by bump_ai_counter().
--
-- Keys (see backend/src/http/rateLimitPerUser.js):
--   req:<user id>   requests this minute
--   tok:<user id>   AI tokens this day
--   tok:all         AI tokens this day, everyone together

create table if not exists public.ai_request_counters (
  key      text primary key,
  hits     bigint not null default 0,
  reset_at timestamptz not null
);

-- RLS on with no policies: only the service-role key (the Worker) can touch it.
alter table public.ai_request_counters enable row level security;

-- Adds p_amount to the counter and returns it. A window that has run out
-- starts again from p_amount. p_amount = 0 reads without spending.
create or replace function public.bump_ai_counter(p_key text, p_window_seconds integer, p_amount bigint)
returns table (hits bigint, reset_at timestamptz)
language sql
security definer
set search_path = public
as $$
  insert into ai_request_counters as c (key, hits, reset_at)
  values (p_key, p_amount, now() + make_interval(secs => p_window_seconds))
  on conflict (key) do update set
    hits     = case when c.reset_at <= now() then excluded.hits     else c.hits + excluded.hits end,
    reset_at = case when c.reset_at <= now() then excluded.reset_at else c.reset_at end
  returning c.hits, c.reset_at;
$$;

revoke all on function public.bump_ai_counter(text, integer, bigint) from public, anon, authenticated;
grant execute on function public.bump_ai_counter(text, integer, bigint) to service_role;

-- Expired rows are rewritten in place, so the table holds at most a couple of
-- rows per user who has ever used Octi. Safe to re-run.
