-- V003: Add trigger index for process_definition

CREATE INDEX IF NOT EXISTS idx_process_def_trigger ON process_definition(trigger_type, status);
