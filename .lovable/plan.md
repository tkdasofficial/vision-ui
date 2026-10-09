# Client Discovery & Email Automation Engine

Builds a self-contained prospecting + cold-outreach system on top of the existing Supabase + Gmail OAuth stack. No paid third-party scraping services.

## Architecture

```text
User → Prospecting UI ──┐
                        ├─► youtube-prospector (edge fn) ──► YouTube Data API v3
                        ├─► web-prospector      (edge fn) ──► Gemini (Search Grounding) → scraper-worker
                        └─► leads table (unified inspection board)
                                    │
                                    ▼
                    outreach-composer (edge fn, Lovable AI) ──► email_queue
                                    │
                                    ▼
                    outreach-dispatcher (cron, 45–90s jitter) ──► Gmail API (user OAuth token)
                                    │
                                    ▼
                    inbox-watcher (cron) ──► detects replies/bounces → freeze / mark invalid
```

## Phase 1 — Data model (migration)

Extend/add tables:
- `leads` (already exists) — add columns: `source` ('youtube'|'web'), `channel_id`, `subscriber_count`, `avg_views`, `niche`, `website`, `industry`, `metadata jsonb`, `status` ('new'|'queued'|'sent'|'replied'|'bounced'|'invalid'), `last_event_at`.
- `prospecting_jobs` — track a run: user_id, source, params (jsonb), target_count, found_count, status, error.
- `email_queue` (exists) — ensure fields: lead_id, subject, body, scheduled_at, sent_at, status, gmail_thread_id, gmail_message_id, error.
- `outreach_campaigns` — user_id, name, pitch_context (what the freelancer offers), tone, follow_up_enabled, throttle_min_sec (45), throttle_max_sec (90).
- Realtime publication for `leads`, `email_queue`, `prospecting_jobs`.

All tables: RLS scoped to `auth.uid()`, GRANTs to `authenticated` + `service_role`.

## Phase 2 — YouTube prospector (edge function)

`supabase/functions/youtube-prospector/index.ts`
- Uses `YOUTUBE_API_KEY` from user's `user_api_keys` (BYOK) — falls back to shared `GEMINI_API_KEY`-adjacent pool only if user has none.
- Loop: `search.list` (paginated via `nextPageToken`) → `channels.list?part=statistics,snippet` → filter subs → `search.list?channelId&order=date` last 15 uploads → `videos.list?part=statistics` → compute avg views → filter → extract emails from `snippet.description` + about + recent video descriptions via regex.
- Streams progress into `prospecting_jobs.found_count` and inserts qualifying rows into `leads`. Stops exactly at target.

## Phase 3 — Web prospector

`supabase/functions/web-prospector/index.ts`
- Calls Gemini with Google Search grounding (`google/gemini-2.5-flash` via Lovable AI Gateway with `google_search` tool) → returns JSON array `{ company, domain, industry }`.
- Enqueues each domain into `scraper-worker`.

`supabase/functions/scraper-worker/index.ts`
- Deno-native fetch (no Puppeteer — edge runtime can't run headless Chromium). For each domain: fetch `/`, `/contact`, `/about`, `/team`, `/contact-us` with rotating UA and 2–4s jitter. Extract emails with the specified regex, dedupe, ignore common noreply/sentry/wixpress false positives.
- Writes to `leads`.
- Note: I'll flag in the UI that pure-JS SPA sites without SSR emails may return empty — this is a real edge-runtime limitation. If the user needs full JS rendering, we'd need an external browser service.

## Phase 4 — Inspection Board UI

`src/pages/Prospecting.tsx` + sidebar link
- Form: source selector (YouTube / Web / Both), niche, sub range, avg-view range, target count.
- Live progress panel subscribed to `prospecting_jobs`.
- Unified leads table (source, name, subs, avg views, emails, status) with row select, bulk delete, and a natural-language command bar → routed through a small `leads-command` edge fn (Lovable AI) that returns a SQL-like filter/action applied client-side.

## Phase 5 — Hyper-personalized composer

`supabase/functions/outreach-composer/index.ts`
- Input: lead row + campaign pitch_context.
- Prompt binds `person_name`/`company`/`niche`/`avg_views`/`industry` into subject + body.
- YouTube pitch template references avg views + niche; web pitch references industry.
- Outputs `{subject, body}`, inserts into `email_queue` with `scheduled_at = now() + cumulative jitter(45–90s)` per user's queue.

## Phase 6 — Dispatcher + inbox watcher

`supabase/functions/outreach-dispatcher/index.ts` — invoked by `pg_cron` every minute:
- Picks `email_queue` rows where `scheduled_at <= now()` and `status='queued'`, one per user per minute, sends via Gmail API using the user's stored OAuth access token (refresh via `google_refresh_token` from `user_integrations`).
- Records `gmail_message_id`, `gmail_thread_id`.

`supabase/functions/inbox-watcher/index.ts` — cron every 2 min:
- `users.messages.list?q=in:inbox newer_than:1d` per connected user.
- For each message: if `In-Reply-To` matches a tracked `gmail_message_id` → mark lead `replied`, cancel any queued follow-ups for that lead.
- If `From: mailer-daemon` or headers contain `X-Failed-Recipients` → mark matching lead `bounced` + `invalid`, purge queued sends.

Cron scheduled via `pg_cron` + `pg_net` (SQL kept out of migration per instructions — I'll run it via `supabase--insert` with the anon key).

## Phase 7 — Theming

`src/pages/Settings.tsx`: theme selector (system/light/dark), writes to `user_settings.theme`. `index.css` already B/W minimal — I'll add explicit red (destructive) for bounced badges and a subtle green for `sent`/`replied` badges only; no palette overhaul.

## Secrets needed

- User provides `YOUTUBE_API_KEY` per user via Integrations → API Keys (already have BYOK infra). No new project-level secrets.
- Uses existing `LOVABLE_API_KEY`, `GOOGLE_CLIENT_ID/SECRET`, and per-user Gmail OAuth tokens already in `user_integrations`.

## Out of scope / limitations to confirm

1. **Puppeteer/Playwright cannot run inside Supabase Edge Functions** (no Chromium). I'll use Deno `fetch` + HTML regex, which covers ~80% of sites. Full JS-rendered scraping would need an external browser service (Browserless, self-hosted). OK to proceed with fetch-only?
2. Gmail API sending under a user's own OAuth requires the `gmail.send` + `gmail.readonly` scopes already configured — confirmed present in `oauth-initiate`.
3. 300–500 sends/day per user is within Gmail's 500/day free-tier and 2000/day Workspace cap — throttle enforces this.

Reply "go" to build, or tell me what to adjust (scope, phase order, scraper strategy).
