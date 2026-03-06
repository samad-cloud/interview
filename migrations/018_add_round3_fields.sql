-- Add Round 3 (avatar deep-dive) fields to candidates table
ALTER TABLE candidates
  ADD COLUMN IF NOT EXISTS round_3_token         UUID DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS round_3_status        TEXT,
  ADD COLUMN IF NOT EXISTS round_3_transcript    TEXT,
  ADD COLUMN IF NOT EXISTS round_3_rating        INTEGER,
  ADD COLUMN IF NOT EXISTS round_3_dossier       JSONB,
  ADD COLUMN IF NOT EXISTS round_3_recording_url TEXT,
  ADD COLUMN IF NOT EXISTS round_3_invited_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS round_3_full_verdict  JSONB;
