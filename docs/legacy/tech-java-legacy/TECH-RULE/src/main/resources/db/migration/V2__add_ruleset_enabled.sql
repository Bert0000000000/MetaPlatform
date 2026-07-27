-- ════════════════════════════════════════════════════════════
-- TECH-RULE V2: 规则集启用/禁用字段
-- P1-RULE-01: 规则优先级与启用/禁用管理
-- ════════════════════════════════════════════════════════════

-- rule_definition 表的 priority 和 enabled 列已在 V1 中创建，此处无需重复添加

-- 为 rule_ruleset 表添加 enabled 字段
ALTER TABLE rule_ruleset ADD COLUMN IF NOT EXISTS enabled BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_rule_ruleset_enabled ON rule_ruleset(enabled);
