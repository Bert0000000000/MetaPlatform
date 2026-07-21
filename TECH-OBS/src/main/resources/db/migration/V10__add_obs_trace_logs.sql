-- V10: Add logs JSONB column to obs_trace for replay support (V14-07)
ALTER TABLE obs_trace ADD COLUMN IF NOT EXISTS logs JSONB NOT NULL DEFAULT '[]'::jsonb;
