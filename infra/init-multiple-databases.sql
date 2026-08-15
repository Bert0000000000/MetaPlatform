-- =============================================================================
-- MetaPlatform 多库初始化（Phase 0.1.3）
-- -----------------------------------------------------------------------------
-- 在 Postgres 首次启动时自动创建所有业务库。
-- 每个业务模块独立 schema/database，便于隔离备份与扩缩容。
-- =============================================================================

-- 主库 metaplatform 已经由 POSTGRES_DB 创建。

-- 知识库（KB / Document / Chunk / Vector 元数据）
CREATE DATABASE metaplatform_kb
    WITH ENCODING 'UTF8'
         LC_COLLATE 'en_US.UTF-8'
         LC_CTYPE 'en_US.UTF-8'
         TEMPLATE template0;

-- 可观测性（日志 / 链路 / 审计）
CREATE DATABASE metaplatform_obs
    WITH ENCODING 'UTF8'
         LC_COLLATE 'en_US.UTF-8'
         LC_CTYPE 'en_US.UTF-8'
         TEMPLATE template0;

-- 本体引擎（Concept / Object / Action / Metric / Version / Draft）
CREATE DATABASE metaplatform_ont
    WITH ENCODING 'UTF8'
         LC_COLLATE 'en_US.UTF-8'
         LC_CTYPE 'en_US.UTF-8'
         TEMPLATE template0;

-- Agent 运行时（Agent / Conversation / Plan / Memory / Checkpoint / Run / Task / SubAgent）
CREATE DATABASE metaplatform_agent
    WITH ENCODING 'UTF8'
         LC_COLLATE 'en_US.UTF-8'
         LC_CTYPE 'en_US.UTF-8'
         TEMPLATE template0;

-- Action 引擎（Action Definition / Version / Proposal / Execution / Audit）
CREATE DATABASE metaplatform_action
    WITH ENCODING 'UTF8'
         LC_COLLATE 'en_US.UTF-8'
         LC_CTYPE 'en_US.UTF-8'
         TEMPLATE template0;

-- Workflow 引擎（Process / Instance / Token / Approval / Saga）
CREATE DATABASE metaplatform_wfe
    WITH ENCODING 'UTF8'
         LC_COLLATE 'en_US.UTF-8'
         LC_CTYPE 'en_US.UTF-8'
         TEMPLATE template0;

-- 后台管理 / IAM（User / Role / SystemConfig / AiModel）
CREATE DATABASE metaplatform_iam
    WITH ENCODING 'UTF8'
         LC_COLLATE 'en_US.UTF-8'
         LC_CTYPE 'en_US.UTF-8'
         TEMPLATE template0;

-- 编排器（Digital-Employee Role Registry / Plan / Dispatcher state）
-- W3-role-registry-persist: 持久化 POST /api/v1/orchestrator/roles 注册的角色
CREATE DATABASE metaplatform_orchestrator
    WITH ENCODING 'UTF8'
         LC_COLLATE 'en_US.UTF-8'
         LC_CTYPE 'en_US.UTF-8'
         TEMPLATE template0;

-- 授权语句：让 meta 用户可以访问这些库
GRANT ALL PRIVILEGES ON DATABASE metaplatform_kb TO meta;
GRANT ALL PRIVILEGES ON DATABASE metaplatform_obs TO meta;
GRANT ALL PRIVILEGES ON DATABASE metaplatform_ont TO meta;
GRANT ALL PRIVILEGES ON DATABASE metaplatform_agent TO meta;
GRANT ALL PRIVILEGES ON DATABASE metaplatform_action TO meta;
GRANT ALL PRIVILEGES ON DATABASE metaplatform_wfe TO meta;
GRANT ALL PRIVILEGES ON DATABASE metaplatform_iam TO meta;
GRANT ALL PRIVILEGES ON DATABASE metaplatform_orchestrator TO meta;
