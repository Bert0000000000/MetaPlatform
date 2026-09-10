"""Idempotent DDL for llmgw-owned tables (P0 close-out 2026-09-09).

llmgw 的表建在 ``PG_DSN`` 指向的库（部署约定为 metaplatform_kb），
而非平台主库（``MATE_DB_URL``），因此**不进平台 alembic 链**：
本模块是这些表的单一事实源，lifespan 启动时 ``ensure_schema()``
幂等执行，运维可用 ``python -m mate_tech_llmgw.schema`` 单独执行。

设计对齐 LiteLLM 的 SpendLogs/DailyUserSpend 模式（三层计量），
P0 先落明细表 ``llm_usage``（含 user_id/api_key_id/provider/duration_ms/
cache_hit/status 列，P1/P5 复用，避免后续 ALTER）与月度配额表
``llmgw_tenant_quota``（列名与 cost/ceiling.py 现有 INSERT 逐字对齐）。
"""

from __future__ import annotations

from typing import Any

import structlog

logger = structlog.get_logger(__name__)

LLMGW_SCHEMA_SQL = """
-- per-request usage detail (LiteLLM SpendLogs pattern; P0)
CREATE TABLE IF NOT EXISTS llm_usage (
  id                BIGSERIAL PRIMARY KEY,
  request_id        VARCHAR(64)  NOT NULL DEFAULT '',
  ts                TIMESTAMPTZ  NOT NULL DEFAULT now(),
  tenant_id         VARCHAR(64)  NOT NULL,
  user_id           VARCHAR(128) NOT NULL DEFAULT 'anonymous',
  api_key_id        VARCHAR(64)  NOT NULL DEFAULT '',
  provider          VARCHAR(32)  NOT NULL DEFAULT '',
  model             VARCHAR(128) NOT NULL,
  prompt_tokens     INT          NOT NULL DEFAULT 0,
  completion_tokens INT          NOT NULL DEFAULT 0,
  total_tokens      INT          NOT NULL DEFAULT 0,
  cache_hit         BOOLEAN      NOT NULL DEFAULT FALSE,
  duration_ms       INT          NOT NULL DEFAULT 0,
  status            VARCHAR(16)  NOT NULL DEFAULT 'success',
  cost_usd          NUMERIC(14,8) NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_llm_usage_tenant_ts ON llm_usage (tenant_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_llm_usage_key_ts    ON llm_usage (api_key_id, ts DESC);

-- monthly tenant quota (column names MUST match cost/ceiling.py INSERT)
CREATE TABLE IF NOT EXISTS llmgw_tenant_quota (
  tenant_id     VARCHAR(64)   NOT NULL,
  month_epoch   INT           NOT NULL,
  tokens_used   BIGINT        NOT NULL DEFAULT 0,
  cost_used_usd NUMERIC(14,8) NOT NULL DEFAULT 0,
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, month_epoch)
);

-- per-(tenant, day, key, model) rollup (LiteLLM DailyUserSpend pattern; P1).
-- Budget checks read ONLY this table, never the detail table.
CREATE TABLE IF NOT EXISTS llm_usage_daily (
  tenant_id         VARCHAR(64)   NOT NULL,
  day               DATE          NOT NULL,
  api_key_id        VARCHAR(64)   NOT NULL DEFAULT '',
  model             VARCHAR(128)  NOT NULL DEFAULT '',
  prompt_tokens     BIGINT        NOT NULL DEFAULT 0,
  completion_tokens BIGINT        NOT NULL DEFAULT 0,
  total_tokens      BIGINT        NOT NULL DEFAULT 0,
  cost_usd          NUMERIC(14,8) NOT NULL DEFAULT 0,
  api_requests      INT           NOT NULL DEFAULT 0,
  failed_requests   INT           NOT NULL DEFAULT 0,
  PRIMARY KEY (tenant_id, day, api_key_id, model)
);
CREATE INDEX IF NOT EXISTS idx_llm_usage_daily_key ON llm_usage_daily (api_key_id, day DESC);

-- per-tenant runtime limits (P3 TenantConfigProvider; soft/max budgets P1)
CREATE TABLE IF NOT EXISTS llmgw_tenant_config (
  tenant_id            VARCHAR(64) PRIMARY KEY,
  rpm_limit            INT           NOT NULL DEFAULT 100,
  tpm_limit            BIGINT        NOT NULL DEFAULT 100000,
  monthly_token_limit  BIGINT        NOT NULL DEFAULT 100000000,
  soft_budget_usd      NUMERIC(12,2),
  max_budget_usd       NUMERIC(12,2),
  daily_cost_limit_usd NUMERIC(10,2) NOT NULL DEFAULT 5.0,
  updated_at           TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- consumer virtual keys (LiteLLM VerificationToken pattern; populated in P5,
-- created now so the spend-on-key UPDATE in the P1 write path is a no-op
-- instead of a failed transaction)
CREATE TABLE IF NOT EXISTS llmgw_api_keys (
  key_id          VARCHAR(64)   PRIMARY KEY,
  tenant_id       VARCHAR(64)   NOT NULL,
  key_name        VARCHAR(128)  NOT NULL DEFAULT '',
  key_hash        CHAR(64)      NOT NULL UNIQUE,
  key_prefix      VARCHAR(16)   NOT NULL DEFAULT '',
  models          TEXT          NOT NULL DEFAULT '[]',
  max_budget_usd  NUMERIC(12,2),
  soft_budget_usd NUMERIC(12,2),
  budget_duration VARCHAR(8),
  budget_reset_at TIMESTAMPTZ,
  tpm_limit       BIGINT,
  rpm_limit       INT,
  spend_usd       NUMERIC(14,8) NOT NULL DEFAULT 0,
  blocked         BOOLEAN       NOT NULL DEFAULT FALSE,
  expires_at      TIMESTAMPTZ,
  last_active_at  TIMESTAMPTZ,
  created_by      VARCHAR(128)  NOT NULL DEFAULT '',
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_llmgw_keys_tenant ON llmgw_api_keys (tenant_id);
"""

# Rollback helper for operators (never executed automatically).
DOWNGRADE_SQL = """
DROP TABLE IF EXISTS llm_usage;
DROP TABLE IF EXISTS llm_usage_daily;
DROP TABLE IF EXISTS llmgw_tenant_quota;
DROP TABLE IF EXISTS llmgw_tenant_config;
DROP TABLE IF EXISTS llmgw_api_keys;
"""


async def ensure_schema(conn: Any) -> None:
    """Idempotently apply LLMGW_SCHEMA_SQL on an asyncpg connection/pool.

    Soft dependency: failures are logged and swallowed so a schema glitch
    can never block service startup (mirrors the quota-bucket degrade
    pattern in main.py).
    """
    try:
        await conn.execute(LLMGW_SCHEMA_SQL)
    except Exception as exc:
        logger.warning("llmgw.schema.ensure_failed", error=str(exc))
    else:
        logger.info("llmgw.schema.ensured")
