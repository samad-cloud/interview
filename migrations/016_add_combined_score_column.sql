-- Add a generated column for combined score (R1 + R2) to enable proper sorting
ALTER TABLE candidates
  ADD COLUMN IF NOT EXISTS combined_score numeric
  GENERATED ALWAYS AS (COALESCE(rating, 0) + COALESCE(round_2_rating, 0)) STORED;
