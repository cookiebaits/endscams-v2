/*
  # Create FTC Stats Table

  ## Summary
  Single-row table storing FTC consumer fraud statistics shown across the site.

  ## New Tables
  - ftc_stats (id=1 fixed): total_loss, total_loss_short, total_reports, total_reports_short,
    yoy_increase, median_loss, identity_theft_victims, report_year, last_updated.

  ## Security
  - RLS enabled. Public SELECT. No public write (admin via service role).
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

DROP POLICY IF EXISTS "Anyone can read ftc stats" ON ftc_stats;
CREATE POLICY "Anyone can read ftc stats"
  ON ftc_stats FOR SELECT TO anon, authenticated USING (true);

INSERT INTO ftc_stats (id, total_loss, total_loss_short, total_reports, total_reports_short, yoy_increase, median_loss, identity_theft_victims, report_year)
VALUES (1, '$12.5 billion', '$12.5B', '2.8 million', '2.8M+', '+14%', '$500', '1.1M', '2026')
ON CONFLICT (id) DO NOTHING;
