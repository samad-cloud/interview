-- Migration 019: Add wizard-specific fields to jobs table
-- Safe to run multiple times (IF NOT EXISTS guards)

ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS headcount integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS target_start_date date,
  ADD COLUMN IF NOT EXISTS employment_type text;

COMMENT ON COLUMN jobs.headcount IS 'Number of open positions for this job';
COMMENT ON COLUMN jobs.target_start_date IS 'Target start date for the hire';
COMMENT ON COLUMN jobs.employment_type IS 'full_time | part_time | contract';
