-- Add final composite score column for 3-round weighted average
ALTER TABLE candidates
  ADD COLUMN IF NOT EXISTS final_composite_score NUMERIC(4,2);
