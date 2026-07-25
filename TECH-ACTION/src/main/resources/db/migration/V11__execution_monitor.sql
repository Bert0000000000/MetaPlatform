-- V11: 执行监控字段（PRD REQ-3.3.4 / REQ-3.3.6）
-- 为 executions 表添加中止与重试相关字段：
--   aborted_at   中止时间
--   aborted_by   中止操作人
--   retry_of     重试来源 executionId（指向原执行）
--   retry_count  重试序号（原执行为 0/NULL，首次重试为 1）

ALTER TABLE executions ADD COLUMN IF NOT EXISTS aborted_at  TIMESTAMPTZ;
ALTER TABLE executions ADD COLUMN IF NOT EXISTS aborted_by  VARCHAR(64);
ALTER TABLE executions ADD COLUMN IF NOT EXISTS retry_of    VARCHAR(64);
ALTER TABLE executions ADD COLUMN IF NOT EXISTS retry_count INT;

-- 重试链路查询索引（按租户 + 原执行 ID 查询重试历史）
CREATE INDEX IF NOT EXISTS idx_exec_retry_of ON executions (tenant_id, retry_of);
