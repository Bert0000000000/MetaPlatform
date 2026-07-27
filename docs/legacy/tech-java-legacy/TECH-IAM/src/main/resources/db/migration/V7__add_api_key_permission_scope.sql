-- V7: P1-IAM-07 API Key 权限范围与吊销增强
-- 在 iam_api_keys 表上扩展：
--   - permissions：JSON 数组字符串，如 [{"resource":"ont:concepts","actions":["read","write"]}]
--     与原 scopes（字符串数组）并存：scopes 保留向后兼容，permissions 表达更细粒度的资源+操作权限。
--   - revoked_reason：吊销原因（可空）
--   - revoked_at：吊销时间（可空）
-- 不新建独立权限表：permissions 直接存储在 iam_api_keys 行内，读写简单、与 Key 生命周期一致。

ALTER TABLE iam_api_keys ADD COLUMN IF NOT EXISTS permissions     TEXT;
ALTER TABLE iam_api_keys ADD COLUMN IF NOT EXISTS revoked_reason  VARCHAR(256);
ALTER TABLE iam_api_keys ADD COLUMN IF NOT EXISTS revoked_at      TIMESTAMP;
