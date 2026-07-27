CREATE VIEW action_execution_stats AS
SELECT tenant_id,
       action_id,
       action_code,
       COUNT(*) AS total_executions,
       COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) AS success_count,
       COUNT(CASE WHEN status = 'FAILED' THEN 1 END) AS failed_count,
       COALESCE(AVG(duration_ms), 0) AS avg_duration_ms,
       MAX(started_at) AS last_executed_at
FROM executions
GROUP BY tenant_id, action_id, action_code;
