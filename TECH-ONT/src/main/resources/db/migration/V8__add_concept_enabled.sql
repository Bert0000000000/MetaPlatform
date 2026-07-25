-- V8: 概念启用/禁用开关（P1-ONT：概念启用/禁用端点）
-- 与 status（生命周期 ACTIVE/INACTIVE/DEPRECATED）正交的快速启停开关
ALTER TABLE ont_concepts ADD COLUMN IF NOT EXISTS enabled BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN ont_concepts.enabled IS '概念是否启用：true=启用，false=禁用';
