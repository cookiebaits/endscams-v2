# EndScams.org — PRD (Product Rebuild for /tracker)

## Original Problem Statement
> Completely rebuild /tracker, deleting all current entries. Leverage Google API to do searches for scam phone numbers under 2 weeks. Pull metadata and update it into the report itself. Also, pull numbers from a Google Sheet, use Google API to search metadata and information about each phone number. Lastly, do not have duplicates and also remove all numbers older than 31 days. Always sort by newest number first.

Follow-up: "wipe existing data and make sure that all of the data on that page is retained only for 31 days and deleted after". Refresh **twice daily**: 6:00 AM PST and 1:00 PM PST.

## Scope (per user)
- Changes are limited to the **/tracker** page and its supporting Supabase edge function + database migration.
- No changes to Home, Report Scam, FTC Scams, Education, Disclaimer, or Triage pages.

## Architecture
- **Frontend**: Vite + React + TypeScript. `/src/pages/TrackerPage.tsx`.
- **Backend / data pipeline**: Supabase Edge Function `fetch-scam-data` (Deno).
- **Storage**: Supabase Postgres table `tracker_entries` (+ `scam_reports` for user submissions, unchanged).
- **Scheduler**: `pg_cron` + `pg_net` running the edge function at 14:00 UTC (6 AM PST) and 21:00 UTC (1 PM PST) daily, plus hourly purge.

## Data Sources (used by the edge function)
1. **FCC/FTC Google Sheet** (public CSV export)  
   `https://docs.google.com/spreadsheets/d/1wA8LivoY-tYG1gLI4BtX06SLARiiS83a`
2. **Google Custom Search API** (9 queries, `dateRestrict=w2` = last 14 days):
   - `site:facebook.com "spellcaster" "Whatsapp" "Healing" "Fortune"`
   - `site:facebook.com "illuminati" "Whatsapp"`
   - `site:instagram.com "spellcaster" "Whatsapp"`
   - `site:facebook.com "btc recovery" "Whatsapp"`
   - `site:instagram.com "btc recovery" "Whatsapp"`
   - `"Whatsapp" "Fortune" "Fortune Telling"`
   - `"Whatsapp" "Magic" "Magician"`
   - `"Whatsapp" "Crypto Recovery"`
   - `"guestbook" spell "WhatsApp"`
3. **BBB Scam Tracker** (direct HTML fetch, no Google quota used):
   - `.../lookupscam?q=all%3Dpaypal%26from%3D0`
   - `.../lookupscam?q=all%3Demergency%26from%3D0`
   - `.../lookupscam?q=all%3Dmillion%26from%3D0`

## Google CSE Quota Plan (100 queries/day free tier)
- Per run: 25 sheet-number lookups + 9 category queries = **34 CSE calls**
- Two runs per day = **68/day** → within free tier headroom.
- BBB is scraped directly, so no CSE cost.

## Pipeline (per run)
1. `DELETE FROM tracker_entries WHERE report_date < today − 31 days`.
2. Fetch sheet CSV, parse dates (`M/D/YY` or `M/D/YYYY`), filter to last 31 days, sort newest first, take 25 newest unique phone numbers.
3. For each of those 25, call Google CSE `"phone" scam` with `dateRestrict=w2`. Append top-3 snippets as metadata.
4. Run 9 targeted CSE queries; extract any phone numbers from titles/snippets; store with the matching category.
5. Fetch 3 BBB pages, strip HTML, extract phone numbers with 120-char context snippet.
6. Deduplicate by `phone_digits` (keep newest report_date).
7. Upsert into `tracker_entries` on conflict `(phone_digits, source_name)`; `expires_at = now() + 31 days`.

## Frontend behaviour
- Sorts **newest first** by `report_date DESC`.
- Client-side hard cutoff: any row with `report_date < now − 31 days` is filtered out even if the DB is stale.
- Client-side dedupe by `phone_digits` (keeps newest).
- Description parsed on segment separator `" | "` into labeled rows (`Subject`, `Notes`, `Google (14d)`, etc.).
- Header copy updated: **"Retained for 31 days, auto-refreshed twice daily (6am & 1pm PST)"**.

## What was implemented (2026-07-21)
- ✅ New migration `20260721060000_rebuild_tracker.sql`: TRUNCATE existing tracker rows, set 31-day default expiry, `purge_old_tracker_entries()` SQL function, three cron jobs (`tracker-refresh-morning-pst`, `tracker-refresh-afternoon-pst`, `tracker-purge-hourly`).
- ✅ Rewrote `supabase/functions/fetch-scam-data/index.ts` with full new pipeline (CSV → newest 25 → CSE metadata → WhatsApp queries → BBB scrape → dedupe → upsert).
- ✅ Updated `src/pages/TrackerPage.tsx` — new `mergeAndSort()` with strict 31-day cutoff + dedupe by digits, richer metadata rendering, 5-source SOURCES block.
- ✅ Verified page renders cleanly (screenshot) — TypeScript compiles.

## Deployment requirements (must be done in Supabase dashboard)
1. **Set edge-function secrets** (Supabase → Edge Functions → `fetch-scam-data` → Secrets):
   - `GOOGLE_API_KEY = AIzaSyCK6cNZv41ozZvjX_xIAdjGTdT4L_ZWScE`
   - `GOOGLE_CX = 70ee405777bb74c54`
   - `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` — auto-provided by Supabase.
2. **Enable Custom Search API** in Google Cloud console (project 963249505235). Was returning `API_KEY_SERVICE_BLOCKED` during dev — please confirm it is enabled and propagated.
3. **Set database GUCs** for the cron jobs (SQL editor):
   ```sql
   ALTER DATABASE postgres SET app.supabase_url = 'https://<your-project>.supabase.co';
   ALTER DATABASE postgres SET app.service_role_key = '<SERVICE_ROLE_JWT>';
   ```
4. **Run the migration** `supabase db push` (or apply `20260721060000_rebuild_tracker.sql`).
5. **Deploy the edge function** `supabase functions deploy fetch-scam-data`.
6. Trigger it once manually or click **"Check for New Numbers"** on /tracker to seed data.

## Prioritized backlog
- P1 — Verify cron actually fires after `app.supabase_url` / `app.service_role_key` are set; check `cron.job_run_details`.
- P1 — If Google CSE returns 403 (`API_KEY_SERVICE_BLOCKED`) after enablement, confirm no HTTP referer restrictions on the key.
- P2 — Optional: swap synchronous CSE loop for `Promise.all` to shave latency (edge function currently sequential to stay well under Deno cold-start timeouts).
- P2 — Consider swapping BBB HTML scraping to their official API if one exists (avoids DOM breakage risk).
- P3 — Expose a per-source count in the tracker header (e.g. `12 from BBB, 25 from Sheet…`).

## Next Actions
1. User to confirm Custom Search API is enabled + secrets set in Supabase.
2. User to apply migration + deploy edge function in Supabase.
3. Click "Check for New Numbers" on /tracker to verify end-to-end. Confirm numbers appear sorted newest-first and older-than-31-day rows are gone.
