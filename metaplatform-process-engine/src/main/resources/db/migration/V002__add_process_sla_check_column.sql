-- V002: Add SLA warning sent flag to process_task

ALTER TABLE process_task ADD COLUMN sla_warning_sent BOOLEAN DEFAULT FALSE;
