-- ════════════════════════════════════════════════════════════
-- TECH-WFE V6: V11-08 APP-APPHUB 版本管理与市场联调相关表
--   - wfe_app_version: 应用版本快照表
--   - wfe_apphub_template: 市场模板表
--   - wfe_apphub_template_install: 模板安装记录表
--   - wfe_apphub_template_comment: 模板评分评论表
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS wfe_app_version (
    id              VARCHAR(64)   PRIMARY KEY,
    tenant_id       VARCHAR(64)   NOT NULL,
    app_id          VARCHAR(64)   NOT NULL,
    version         VARCHAR(64)   NOT NULL,
    change_log      TEXT,
    snapshot        TEXT          NOT NULL,
    status          VARCHAR(32)   NOT NULL DEFAULT 'DRAFT',
    published_by    VARCHAR(64),
    published_at    TIMESTAMPTZ,
    rolled_back_by  VARCHAR(64),
    rolled_back_at  TIMESTAMPTZ,
    created_by      VARCHAR(64),
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    CONSTRAINT uk_wfe_appv_tenant_app_version UNIQUE (tenant_id, app_id, version)
);

CREATE INDEX IF NOT EXISTS idx_wfe_appv_tenant_app ON wfe_app_version (tenant_id, app_id);
CREATE INDEX IF NOT EXISTS idx_wfe_appv_status ON wfe_app_version (tenant_id, app_id, status);

CREATE TABLE IF NOT EXISTS wfe_apphub_template (
    id              VARCHAR(64)   PRIMARY KEY,
    tenant_id       VARCHAR(64)   NOT NULL,
    template_id     VARCHAR(64)   NOT NULL,
    name            VARCHAR(256)  NOT NULL,
    category        VARCHAR(32)   NOT NULL,
    description     TEXT,
    icon            VARCHAR(512),
    tags            VARCHAR(1024),
    config_snapshot TEXT,
    preview         VARCHAR(1024),
    download_count  BIGINT        NOT NULL DEFAULT 0,
    rating_sum      BIGINT        NOT NULL DEFAULT 0,
    rating_count    BIGINT        NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    CONSTRAINT uk_wfe_tmpl_tenant_template_id UNIQUE (tenant_id, template_id)
);

CREATE INDEX IF NOT EXISTS idx_wfe_tmpl_tenant ON wfe_apphub_template (tenant_id);
CREATE INDEX IF NOT EXISTS idx_wfe_tmpl_category ON wfe_apphub_template (tenant_id, category);

CREATE TABLE IF NOT EXISTS wfe_apphub_template_install (
    id              VARCHAR(64)   PRIMARY KEY,
    tenant_id       VARCHAR(64)   NOT NULL,
    template_id     VARCHAR(64)   NOT NULL,
    app_id          VARCHAR(64),
    installed_by    VARCHAR(64),
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    CONSTRAINT uk_wfe_tmpl_install_tenant_template UNIQUE (tenant_id, template_id)
);

CREATE INDEX IF NOT EXISTS idx_wfe_tmpl_install_tenant ON wfe_apphub_template_install (tenant_id);

CREATE TABLE IF NOT EXISTS wfe_apphub_template_comment (
    id              VARCHAR(64)   PRIMARY KEY,
    tenant_id       VARCHAR(64)   NOT NULL,
    template_id     VARCHAR(64)   NOT NULL,
    user_id         VARCHAR(64)   NOT NULL,
    rating          INT           NOT NULL,
    comment         TEXT,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    CONSTRAINT uk_wfe_tmpl_comment_tenant_template_user UNIQUE (tenant_id, template_id, user_id),
    CONSTRAINT chk_wfe_tmpl_comment_rating CHECK (rating BETWEEN 1 AND 5)
);

CREATE INDEX IF NOT EXISTS idx_wfe_tmpl_comment_template ON wfe_apphub_template_comment (tenant_id, template_id);
