/*
# Fix tracker_entries SELECT policy for anon readability

## Problem
The existing anon SELECT policy only allows reading rows where `expires_at > now()`.
If `expires_at` is NULL or somehow set to a past date, those rows become invisible
to the browser (which uses the anon key), causing the tracker to appear empty
in incognito mode even though data was imported.

## Changes
1. Drop the existing "Public read access to active tracker entries" SELECT policy
2. Create a new SELECT policy that allows anon to read ALL tracker_entries rows
   (expired rows are filtered client-side by the 60-day/6-month retention logic)
3. Keep all other existing policies unchanged

## Security
- SELECT is intentionally public (TO anon, authenticated) because this is a
  no-auth public threat intelligence database — anyone can view scam phone numbers
- INSERT/UPDATE/DELETE policies remain unchanged
*/

DROP POLICY IF EXISTS "Public read access to active tracker entries" ON tracker_entries;
DROP POLICY IF EXISTS "Authenticated read access to tracker entries" ON tracker_entries;

CREATE POLICY "Public read access to all tracker entries"
ON tracker_entries FOR SELECT
TO anon, authenticated
USING (true);
