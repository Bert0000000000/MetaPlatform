-- V4: 概念层级增强（P1-ONT-07）
-- Phase 2 Sprint 2：增加 parent_concept_id 与 level 字段用于层级管理
-- 注意：V1 中已有 parent_concept_id 与 depth 字段；这里在 ont_concepts 上额外加冗余 level 与概念层级索引

ALTER TABLE ont_concepts ADD COLUMN IF NOT EXISTS level INT NOT NULL DEFAULT 1;

-- idx_ont_concepts_parent 已经存在；若不存在则创建
CREATE INDEX IF NOT EXISTS idx_ont_concepts_parent ON ont_concepts(parent_concept_id);