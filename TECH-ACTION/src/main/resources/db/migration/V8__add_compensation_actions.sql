ALTER TABLE action_orchestration_execution ADD COLUMN compensation_actions JSONB DEFAULT '[]'::jsonb;
