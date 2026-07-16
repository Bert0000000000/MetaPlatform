-- ============================================================================
-- v1.0.1 M3 — Flowable BPMN 流程支持
-- 新增：app_workflow_definitions、app_form_workflows、form_submissions
-- 说明：
--   - app_workflows / app_workflow_instances / app_todos 为 v1.0.1 Sprint 0
--     预留的简化流程表，本次不删除，但新流程统一走 Flowable 引擎。
--   - 业务层用 app_workflow_definitions 映射 Flowable deployment/processDefinition。
--   - form_submissions 记录每一次表单提交，并关联动态表 row_id 与流程实例。
-- ============================================================================

-- ----------------------------------------------------------------------------
-- app_workflow_definitions: 流程定义业务元数据
-- ----------------------------------------------------------------------------
CREATE TABLE app_workflow_definitions (
    id                      BIGSERIAL PRIMARY KEY,
    app_id                  BIGINT NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
    form_id                 BIGINT REFERENCES app_forms(id) ON DELETE SET NULL,
    name                    VARCHAR(255) NOT NULL,
    process_key             VARCHAR(128) NOT NULL,
    code                    VARCHAR(128) NOT NULL,
    deployment_id           VARCHAR(64),
    process_definition_id   VARCHAR(64),
    process_definition_key  VARCHAR(128),
    bpmn_xml                TEXT,
    status                  VARCHAR(32) NOT NULL DEFAULT 'draft',
    field_permissions       TEXT,
    version                 INTEGER NOT NULL DEFAULT 1,
    created_by              VARCHAR(64) NOT NULL,
    created_at              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (app_id, code)
);
CREATE INDEX idx_workflow_def_app ON app_workflow_definitions(app_id);
CREATE INDEX idx_workflow_def_form ON app_workflow_definitions(form_id);
CREATE INDEX idx_workflow_def_status ON app_workflow_definitions(status);

-- ----------------------------------------------------------------------------
-- app_form_workflows: 表单与流程的绑定关系
-- ----------------------------------------------------------------------------
CREATE TABLE app_form_workflows (
    id                      BIGSERIAL PRIMARY KEY,
    app_id                  BIGINT NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
    form_id                 BIGINT NOT NULL REFERENCES app_forms(id) ON DELETE CASCADE,
    workflow_definition_id  BIGINT NOT NULL REFERENCES app_workflow_definitions(id) ON DELETE CASCADE,
    enabled                 BOOLEAN NOT NULL DEFAULT true,
    created_at              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (app_id, form_id)
);
CREATE INDEX idx_form_workflow_form ON app_form_workflows(form_id);
CREATE INDEX idx_form_workflow_workflow ON app_form_workflows(workflow_definition_id);

-- ----------------------------------------------------------------------------
-- form_submissions: 表单提交记录
-- ----------------------------------------------------------------------------
CREATE TABLE form_submissions (
    id                      BIGSERIAL PRIMARY KEY,
    app_id                  BIGINT NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
    form_id                 BIGINT NOT NULL REFERENCES app_forms(id) ON DELETE CASCADE,
    object_id               BIGINT NOT NULL REFERENCES app_objects(id) ON DELETE CASCADE,
    row_id                  BIGINT NOT NULL,
    values_json             TEXT NOT NULL,
    process_instance_id     VARCHAR(64),
    workflow_status         VARCHAR(32) DEFAULT 'none',
    current_task_id         VARCHAR(64),
    current_task_name       VARCHAR(128),
    submitter_id            VARCHAR(64),
    submitter_email         VARCHAR(255),
    submitter_name          VARCHAR(255),
    tenant_id               VARCHAR(64) NOT NULL,
    created_at              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_submissions_form ON form_submissions(form_id);
CREATE INDEX idx_submissions_app ON form_submissions(app_id);
CREATE INDEX idx_submissions_instance ON form_submissions(process_instance_id);
CREATE INDEX idx_submissions_status ON form_submissions(workflow_status);
