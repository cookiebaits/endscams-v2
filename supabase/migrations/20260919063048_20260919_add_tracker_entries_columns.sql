/*
  # Add missing metadata columns to tracker_entries

  ## What this migration does
  1. Adds columns that the tracker UI writes but the schema was missing:
     - `impersonated_company` (text, nullable) — brand being impersonated
     - `invoice_number` (text, nullable) — fake invoice / reference number
     - `amount_charged` (text, nullable) — dollar amount demanded
     - `updated_at` (timestamptz, default now) — last modification timestamp
  2. These columns are nullable so existing rows are unaffected.

  ## Security
  - No RLS policy changes. Existing anon read/write policies remain in effect.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tracker_entries' AND column_name = 'impersonated_company'
  ) THEN
    ALTER TABLE tracker_entries ADD COLUMN impersonated_company text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tracker_entries' AND column_name = 'invoice_number'
  ) THEN
    ALTER TABLE tracker_entries ADD COLUMN invoice_number text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tracker_entries' AND column_name = 'amount_charged'
  ) THEN
    ALTER TABLE tracker_entries ADD COLUMN amount_charged text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tracker_entries' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE tracker_entries ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;
END $$;
