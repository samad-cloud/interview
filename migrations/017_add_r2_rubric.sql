-- Add technical interview rubric column to jobs table
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS r2_rubric TEXT;
