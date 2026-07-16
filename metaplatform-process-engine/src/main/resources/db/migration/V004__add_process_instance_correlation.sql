-- V004: Add correlation_id to process_instance

ALTER TABLE process_instance ADD COLUMN correlation_id VARCHAR(200);
CREATE INDEX IF NOT EXISTS idx_process_instance_correlation ON process_instance(correlation_id);
