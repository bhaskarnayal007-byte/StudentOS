# Launch checklist

The code fixes from the October launch review are done (SVG takeover, CSP, AI
budget floor, install size, skipping unchanged saves). What's left needs your
dashboards and a budget decision, not code.

## Before any public demo

1. **Custom email sender.** Supabase → Authentication → Emails → SMTP
   Settings. Any SMTP provider works (Resend, Brevo, Postmark — check their
   current free-tier daily limits against your class size). Then Authentication
   → Rate Limits → raise "emails sent per hour". Without this, signup is capped
   at ~3 students an hour.
2. **Sign-in rate limit.** Same Rate Limits page: sign-ins are ~30 per 5
   minutes per IP. A class on one campus network shares an IP — raise it before
   a live demo.
3. **Deploy and check the CSP.** Merge `launch-readiness` to `main`, open the
   live site, sign in, and open DevTools → Console. Any "Refused to connect"
   line names a host missing from `frontend/vercel.json`. (Checked locally
   against the built app; Vercel itself not yet.)

## Before a real cohort

4. **Render paid plan** (~$7/mo): `plan: free` → `plan: starter` in
   `render.yaml`. Until then the keep-awake workflow covers the sleeping.
5. **Supabase Pro** (~$25/mo). The write test below is why.
6. **Decide who pays for the AI.** Free quota is 600k tokens/day ≈ 60
   assistant messages across *everyone*. Each student is guaranteed 30k/day
   (~3 messages) until the shared pool runs out, then everyone gets "out of
   capacity for today". Knobs on Render: `AI_DAILY_TOKENS`,
   `AI_MIN_USER_TOKENS`, `AI_MAX_REPLY_TOKENS`. Paid usage at 1000 students × 3
   messages/day is roughly $5–15/day.

## Database writes at scale (measured 28 Oct, free tier)

Each write is the app's real `user_state` upsert through a user's own session.

| Concurrent writers | 50 KB state p50 / p95 | Errors |
|---|---|---|
| 100 | 0.6–1.2 s / 0.9–2.5 s | 0 |
| 250 | 2.5–4.8 s / 6–16 s | 0–5% |
| 500 | 13–53 s / 36–55 s | 0 |
| 1000 | — | 79% (520s and 120 s timeouts) |

The database sustains roughly **30–40 writes/s** (1 KB payloads hit the same
ceiling, so it's the database, not upload bandwidth). The app saves at most
once per 1.2 s per editing student, and now skips saves that change nothing,
so a few hundred students editing at the same moment is the practical limit
on the free tier. That's comfortable for a 100–200 student pilot; re-run
`backend/scripts/load/writes.mjs` after moving to Pro before going bigger.

## Known and accepted

- Rate limits and AI budgets live in memory: correct on one Render instance,
  must move to a shared store before running two.
- Two devices editing in the same second: the later save wins. Per-entity
  tables are the upgrade path (see `supabase/migrations/0001_user_state.sql`).
