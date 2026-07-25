-- V17: 补齐 iam_outbox_messages 表的 topic/last_error/trace_id 字段
-- 实体 IamOutboxMessageEntity 包含这些字段，但 V4 漏建。
ALTER TABLE iam_outbox_messages ADD COLUMN IF NOT EXISTS topic VARCHAR(256);
ALTER TABLE iam_outbox_messages ADD COLUMN IF NOT EXISTS last_error VARCHAR(1024);
ALTER TABLE iam_outbox_messages ADD COLUMN IF NOT EXISTS trace_id VARCHAR(64);
