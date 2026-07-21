-- V9: MCP Server 字段补全（V13-01）
-- 增加监听地址、端口、SSE 端点、认证、超时、并发、健康检查、最后心跳等字段

ALTER TABLE mcp_server
    ADD COLUMN host VARCHAR(256),
    ADD COLUMN port INTEGER,
    ADD COLUMN sse_endpoint VARCHAR(2048),
    ADD COLUMN auth_type VARCHAR(20),
    ADD COLUMN auth_config TEXT,
    ADD COLUMN timeout_ms INTEGER,
    ADD COLUMN max_concurrent_calls INTEGER,
    ADD COLUMN health_check_url VARCHAR(2048),
    ADD COLUMN last_heartbeat_at TIMESTAMP,
    ADD COLUMN last_error_message TEXT;
