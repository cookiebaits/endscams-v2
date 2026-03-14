/*
  # Add File Upload Support to Scam Reports

  1. Changes
    - Add `file_url` column to `scam_reports` table for storing uploaded file URLs
    - Add `file_name` column to `scam_reports` table for storing original file names
    - Add `file_type` column to `scam_reports` table for storing file MIME types
    
  2. Storage
    - Create storage bucket for scam report attachments
    - Enable RLS on storage bucket
    - Add policies for authenticated and anonymous uploads
*/

-- Add file columns to scam_reports table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'scam_reports' AND column_name = 'file_url'
  ) THEN
    ALTER TABLE scam_reports ADD COLUMN file_url text;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'scam_reports' AND column_name = 'file_name'
  ) THEN
    ALTER TABLE scam_reports ADD COLUMN file_name text;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'scam_reports' AND column_name = 'file_type'
  ) THEN
    ALTER TABLE scam_reports ADD COLUMN file_type text;
  END IF;
END $$;

-- Create storage bucket for scam report files
INSERT INTO storage.buckets (id, name, public)
VALUES ('scam-reports', 'scam-reports', true)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist
DO $$
BEGIN
  DROP POLICY IF EXISTS "Anyone can upload scam report files" ON storage.objects;
  DROP POLICY IF EXISTS "Anyone can view scam report files" ON storage.objects;
END $$;

-- Create storage policies
CREATE POLICY "Anyone can upload scam report files"
  ON storage.objects
  FOR INSERT
  TO public
  WITH CHECK (bucket_id = 'scam-reports');

CREATE POLICY "Anyone can view scam report files"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'scam-reports');
