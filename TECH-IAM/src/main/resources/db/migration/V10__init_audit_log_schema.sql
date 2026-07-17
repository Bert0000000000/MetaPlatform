-- V10: P1-IAM-09 审计日志表（操作日志/登录日志/权限变更日志）
-- 约束：
--   - 追加写入，不支持修改/删除（append-only）
--   - id 采用 UUID 字符串（与既有 IAM 主键约定一致：VARCHAR(64)）
--   - metadata：JSON 字符串，TEXT 存储（与 scopes/actions 等约定一致）
--   - action: LOGIN/LOGOUT/CREATE/UPDATE/DELETE/PERMISSION_CHANGE/ROLE_ASSIGN/ROLE_REVOKE
--   - status: SUCCESS/FAILED

CREATE TABLE IF NOT EXISTS iam_audit_log (
    id              VARCHAR(64)    PRIMARY KEY,
    tenant_id       VARCHAR(64)    NOT NULL,
    user_id         VARCHAR(64),
    action          VARCHAR(32)    NOT NULL,
    resource_type   VARCHAR(64),
    resource_id     VARCHAR(64),
    description     TEXT,
    ip_address      VARCHAR(64),
    user_agent      VARCHAR(512),
    trace_id        VARCHAR(64),
    status          VARCHAR(16)    NOT NULL DEFAULT 'SUCCESS',
    metadata        TEXT,
    created_at      TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_tenant_created ON iam_audit_log(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_user ON iam_audit_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action ON iam_audit_log(action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_status ON iam_audit_log(status);
CREATE INDEX IF NOT EXISTS idx_audit_resource ON iam_audit_log(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_trace ON iam_audit_log(trace_id);
