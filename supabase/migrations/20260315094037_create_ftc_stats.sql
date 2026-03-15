/*
  # Create FTC Stats Table

  ## Summary
  Stores the FTC consumer fraud statistics that are displayed across the site.
  The admin can update these at any time by clicking the footer copyright text.

  ## New Tables
  - `ftc_stats`
    - `id` (integer, primary key, always 1 — single-row table)
    - `total_loss` (text) — e.g. "$12.5 billion"
    - `total_loss_short` (text) — e.g. "$12.5B" (used in cards)
    - `total_reports` (text) — e.g. "2.8 million"
    - `total_reports_short` (text) — e.g. "2.8M+"
    - `yoy_increase` (text) — e.g. "+14%"
    - `median_loss` (text) — e.g. "$500"
    - `identity_theft_victims` (text) — e.g. "1.1M"
    - `report_year` (text) — e.g. "2026"
    - `last_updated` (timestamptz)

  ## Security
  - RLS enabled
  - Public SELECT (stats are public data)
  - No public INSERT/UPDATE/DELETE (admin-only via service role)
*/

CREATE TABLE IF NOT EXISTS ftc_stats (
  id integer PRIMARY KEY DEFAULT 1,
  total_loss text NOT NULL DEFAULT '$12.5 billion',
  total_loss_short text NOT NULL DEFAULT '$12.5B',
  total_reports text NOT NULL DEFAULT '2.8 million',
  total_reports_short text NOT NULL DEFAULT '2.8M+',
  yoy_increase text NOT NULL DEFAULT '+14%',
  median_loss text NOT NULL DEFAULT '$500',
  identity_theft_victims text NOT NULL DEFAULT '1.1M',
  report_year text NOT NULL DEFAULT '2026',
  last_updated timestamptz DEFAULT now(),
  CONSTRAINT single_row CHECK (id = 1)
);

ALTER TABLE ftc_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read ftc stats"
  ON ftc_stats FOR SELECT
  TO anon, authenticated
  USING (true);

INSERT INTO ftc_stats (id, total_loss, total_loss_short, total_reports, total_reports_short, yoy_increase, median_loss, identity_theft_victims, report_year)
VALUES (1, '$12.5 billion', '$12.5B', '2.8 million', '2.8M+', '+14%', '$500', '1.1M', '2026')
ON CONFLICT (id) DO NOTHING;
