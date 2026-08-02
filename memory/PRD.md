# EndScams.org — PRD (Product Rebuild for /tracker)

## Original Problem Statement
> Completely rebuild /tracker, deleting all current entries. Leverage Google API to do searches for scam phone numbers under 2 weeks. Pull metadata and update it into the report itself. Also, pull numbers from a Google Sheet, use Google API to search metadata and information about each phone number. Lastly, do not have duplicates and also remove all numbers older than 31 days. Always sort by newest number first.

Follow-ups:
- Wipe existing data + 31-day retention on /tracker.
- Refresh twice daily: 6 AM PST and 1 PM PST.
- Secrets must live in **Dokploy Environment tab** for privacy (nothing in Supabase secrets).

## Scope (per user)
- Changes limited to `/tracker`, plus one new backend microservice (`tracker-fetcher`).

## Architecture (final, iteration 2)
- **Frontend**: Vite + React + TypeScript, served by Nginx via existing `endscams` container.
- **tracker-fetcher**: **New** Deno container in `docker-compose.yml`. Owns the /tracker data pipeline. All secrets come from Dokploy env vars. Exposes:
  - `GET /health`
  - `POST /refresh` (CORS-restricted to `ALLOWED_ORIGIN`)
- **Storage**: Supabase Postgres `tracker_entries` (RLS unchanged; fetcher writes via SERVICE_ROLE key).
- **Scheduler**: Self-contained loop inside fetcher container — fires at 14:00 UTC (6 AM PST) and 21:00 UTC (1 PM PST). No `pg_cron` needed.
- **Traefik**: Fetcher routed at `https://fetcher.endscams.org` (Let's Encrypt via existing dokploy-network).

## Data Sources
1. **FCC/FTC Google Sheet** (CSV export). Newest 25 phones/run → Google CSE metadata (`dateRestrict=w2`).
2. **Google Custom Search API** (9 queries, `dateRestrict=w2`):
   - `site:facebook.com "spellcaster" "Whatsapp" "Healing" "Fortune"`
   - `site:facebook.com "illuminati" "Whatsapp"`
   - `site:instagram.com "spellcaster" "Whatsapp"`
   - `site:facebook.com "btc recovery" "Whatsapp"`
   - `site:instagram.com "btc recovery" "Whatsapp"`
   - `"Whatsapp" "Fortune" "Fortune Telling"`
   - `"Whatsapp" "Magic" "Magician"`
   - `"Whatsapp" "Crypto Recovery"`
   - `"guestbook" spell "WhatsApp"`
3. **BBB Scam Tracker** — direct HTML scrape (no Google quota):
   - `.../lookupscam?q=all%3Dpaypal%26from%3D0`
   - `.../lookupscam?q=all%3Demergency%26from%3D0`
   - `.../lookupscam?q=all%3Dmillion%26from%3D0`

## Google CSE Quota Plan (100/day free tier)
- Per run: 25 sheet lookups + 9 category queries = **34 calls**
- Two runs/day = **68/day** — well under 100.

## Pipeline (per run)
1. Purge >31-day rows.
2. Fetch Sheet CSV → newest 25 unique phones within 31 days.
3. Enrich each with CSE snippets (`dateRestrict=w2`).
4. Run 9 targeted CSE queries; extract phones from titles/snippets.
5. Scrape 3 BBB pages; extract phones with 120-char context.
6. Dedupe by `phone_digits` (keep newest report_date).
7. Upsert on `(phone_digits, source_name)`; `expires_at = now() + 31 days`.

## Frontend behaviour
- Sort newest first (`report_date DESC`).
- Client-side hard cutoff at 31 days + dedupe by digits.
- Description rendered as labeled rows (`Subject:`, `Notes:`, `Google (14d):`, …).
- Header: **"Retained for 31 days, auto-refreshed twice daily (6am & 1pm PST)"**.
- "Check for New Numbers" now POSTs to `${VITE_FETCHER_URL}/refresh` (no more Supabase edge-function URL / anon key on this path).

## Files changed / added (2026-07-21)
- **Added** `fetcher/main.ts` — Deno HTTP server, scheduler & pipeline (~450 lines).
- **Added** `fetcher/Dockerfile` — Deno 1.46 alpine.
- **Modified** `docker-compose.yml` — added `tracker-fetcher` service with Traefik labels for `fetcher.endscams.org`.
- **Modified** `Dockerfile` — accepts `VITE_FETCHER_URL` build-arg.
- **Modified** `src/pages/TrackerPage.tsx` — sort-newest-first, 31-day cutoff, digit-dedupe, richer metadata rendering, "Check for New Numbers" now hits fetcher `/refresh`.
- **Modified** `supabase/migrations/20260721060000_rebuild_tracker.sql` — TRUNCATE + 31-day default + `purge_old_tracker_entries()` helper. pg_cron removed (scheduler moved to fetcher).
- **Deleted** `supabase/functions/fetch-scam-data/` (edge function no longer used).
- **Added** `.env.example` — full Dokploy env-var checklist.

## Dokploy Environment tab — required vars
```
# Frontend build args
VITE_SUPABASE_URL=https://<your-project>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-jwt>
VITE_FETCHER_URL=https://fetcher.endscams.org

# tracker-fetcher runtime (never exposed to browser)
GOOGLE_API_KEY=AIzaSy...
GOOGLE_CX=70ee405777bb74c54
SUPABASE_URL=https://<your-project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-jwt>
ALLOWED_ORIGIN=https://endscams.org
```

## Deployment steps
1. Point new DNS record `fetcher.endscams.org` at your Dokploy server (proxied in Cloudflare).
2. Apply migration `20260721060000_rebuild_tracker.sql` on Supabase.
3. Fill the Environment vars above in Dokploy.
4. Redeploy the compose project → two services (`endscams`, `tracker-fetcher`) come up.
5. Verify: `curl https://fetcher.endscams.org/health` → `{ "ok": true, ... }`.
6. Open `/tracker` and click "Check for New Numbers".

## Known blocker (2026-07-21)
- Google CSE still returns `API_KEY_SERVICE_BLOCKED`. The API is enabled but the API **key** has API restrictions that don't include Custom Search API. User must edit the key in Google Cloud console → Credentials → "API restrictions" → either "Don't restrict key" or add Custom Search API.

## Backlog
- P1 — Confirm CSE works end-to-end after user unrestricts the API key.
- P2 — If Deno cold-start > 5s becomes an issue, parallelise CSE calls with `Promise.all` + concurrency cap of 3.
- P2 — Add basic secret to `/refresh` (HMAC signature or shared bearer token) so only the frontend + Dokploy admin can trigger it.
- P3 — Show per-source counts in the tracker header ("12 from BBB, 25 from Sheet, 8 from Google").
- P3 — Auto-generate OG images per number for a "Share this scammer" button (community amplification / SEO).

## Next Actions
1. **User**: Unrestrict Google API key (see "Known blocker" above).
2. **User**: Add DNS record for `fetcher.endscams.org` in Cloudflare.
3. **User**: Fill env vars in Dokploy per the block above.
4. **User**: Apply migration + `docker-compose up -d --build`.
