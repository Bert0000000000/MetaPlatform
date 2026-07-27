-- V10: MCP Client Connection 字段补全（V13-02）
-- 增加 clientType、baseUrl、认证、超时、headers、关联 serverIds 等字段

ALTER TABLE mcp_client_connection
    ADD COLUMN base_url VARCHAR(2048),
    ADD COLUMN client_type VARCHAR(32),
    ADD COLUMN auth_type VARCHAR(20),
    ADD COLUMN auth_token VARCHAR(2048),
    ADD COLUMN timeout_ms INTEGER,
    ADD COLUMN headers TEXT,
    ADD COLUMN server_ids TEXT;
