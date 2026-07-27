-- =============================================================================
-- V2: P2.1.1 KB / Document / Chunk / Vector / Binding 数据模型
-- -----------------------------------------------------------------------------
-- 完整知识库核心表，覆盖：
--   - kb_knowledge_base        知识库主表
--   - kb_document              文档元数据
--   - kb_chunk                 切片（最小检索单元）
--   - kb_chunk_vector          向量引用（Milvus ID）
--   - kb_chunk_strategy        切片策略模板
--   - kb_kb_binding            KB 绑定（Agent / AgentSpec / Object）
--   - kb_retrieval_config      检索配置（topK / threshold / filter）
-- =============================================================================

CREATE TABLE IF NOT EXISTS kb_knowledge_base (
    id              VARCHAR(64)    PRIMARY KEY,
    tenant_id       VARCHAR(64)    NOT NULL,
    kb_code         VARCHAR(128)   NOT NULL,
    display_name    VARCHAR(256)   NOT NULL,
    description     TEXT,
    kb_kind         VARCHAR(32)    NOT NULL DEFAULT 'GENERAL', -- GENERAL / DOMAIN / FAQ / POLICY
    embedding_model VARCHAR(128)   NOT NULL DEFAULT 'text-embedding-v3',
    vector_dim      INT            NOT NULL DEFAULT 1024,
    enabled         BOOLEAN        NOT NULL DEFAULT TRUE,
    version         INT            NOT NULL DEFAULT 1,
    deleted         BOOLEAN        NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_kb_code UNIQUE (tenant_id, kb_code)
);

CREATE INDEX IF NOT EXISTS idx_kb_tenant_enabled ON kb_knowledge_base(tenant_id, enabled, deleted);

CREATE TABLE IF NOT EXISTS kb_chunk_strategy (
    id              VARCHAR(64)    PRIMARY KEY,
    tenant_id       VARCHAR(64)    NOT NULL,
    strategy_code   VARCHAR(128)   NOT NULL,
    display_name    VARCHAR(256)   NOT NULL,
    strategy_kind   VARCHAR(32)    NOT NULL,           -- PARAGRAPH / HEADING / TOKEN / SENTENCE
    chunk_size      INT            NOT NULL DEFAULT 500,
    overlap         INT            NOT NULL DEFAULT 50,
    split_chars     TEXT,                              -- JSON 数组 ["\n\n","\n","。"]
    enabled         BOOLEAN        NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_strategy_code UNIQUE (tenant_id, strategy_code)
);

CREATE TABLE IF NOT EXISTS kb_document (
    id              VARCHAR(64)    PRIMARY KEY,
    tenant_id       VARCHAR(64)    NOT NULL,
    kb_id           VARCHAR(64)    NOT NULL,
    document_code   VARCHAR(128)   NOT NULL,
    title           VARCHAR(512)   NOT NULL,
    source_uri      TEXT,
    mime_type       VARCHAR(64),
    file_size       BIGINT,
    storage_key     VARCHAR(512),                     -- MinIO 对象 key
    storage_bucket  VARCHAR(128),
    strategy_id     VARCHAR(64),
    status          VARCHAR(32)    NOT NULL DEFAULT 'UPLOADED', -- UPLOADED / PARSING / CHUNKING / EMBEDDING / READY / FAILED
    parse_error     TEXT,
    chunk_count     INT            NOT NULL DEFAULT 0,
    version         INT            NOT NULL DEFAULT 1,
    metadata        TEXT,                              -- JSON: tags / author / source / concept
    deleted         BOOLEAN        NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_doc_code UNIQUE (tenant_id, document_code),
    CONSTRAINT fk_doc_kb FOREIGN KEY (kb_id) REFERENCES kb_knowledge_base(id) ON DELETE RESTRICT,
    CONSTRAINT fk_doc_strategy FOREIGN KEY (strategy_id) REFERENCES kb_chunk_strategy(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_doc_kb ON kb_document(kb_id, status, deleted);
CREATE INDEX IF NOT EXISTS idx_doc_tenant ON kb_document(tenant_id, status, deleted);

CREATE TABLE IF NOT EXISTS kb_chunk (
    id              VARCHAR(64)    PRIMARY KEY,
    tenant_id       VARCHAR(64)    NOT NULL,
    kb_id           VARCHAR(64)    NOT NULL,
    document_id     VARCHAR(64)    NOT NULL,
    chunk_index     INT            NOT NULL,
    content         TEXT           NOT NULL,
    content_hash    VARCHAR(128)   NOT NULL,             -- 用于去重
    token_count     INT            NOT NULL DEFAULT 0,
    metadata        TEXT,                              -- JSON: page / section / heading_path / concept
    embedding_id    VARCHAR(64),                      -- Milvus 中对应的向量 ID
    reviewed        BOOLEAN        NOT NULL DEFAULT FALSE,
    review_status   VARCHAR(16)    NOT NULL DEFAULT 'PENDING',  -- PENDING / APPROVED / REJECTED
    review_comment  TEXT,
    deleted         BOOLEAN        NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_chunk_doc_idx UNIQUE (document_id, chunk_index),
    CONSTRAINT fk_chunk_doc FOREIGN KEY (document_id) REFERENCES kb_document(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_chunk_kb ON kb_chunk(kb_id, reviewed, deleted);
CREATE INDEX IF NOT EXISTS idx_chunk_doc ON kb_chunk(document_id);
CREATE INDEX IF NOT EXISTS idx_chunk_hash ON kb_chunk(content_hash);

CREATE TABLE IF NOT EXISTS kb_kb_binding (
    id              VARCHAR(64)    PRIMARY KEY,
    tenant_id       VARCHAR(64)    NOT NULL,
    kb_id           VARCHAR(64)    NOT NULL,
    bind_type       VARCHAR(32)    NOT NULL,            -- AGENT / AGENT_SPEC / ONTOLOGY_OBJECT / APP_PAGE
    bind_key        VARCHAR(128)   NOT NULL,            -- e.g. agentId / customerId / pageCode
    enabled         BOOLEAN        NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_binding UNIQUE (tenant_id, kb_id, bind_type, bind_key)
);

CREATE INDEX IF NOT EXISTS idx_binding_lookup ON kb_kb_binding(tenant_id, bind_type, bind_key);

CREATE TABLE IF NOT EXISTS kb_retrieval_config (
    id              VARCHAR(64)    PRIMARY KEY,
    tenant_id       VARCHAR(64)    NOT NULL,
    kb_id           VARCHAR(64)    NOT NULL,
    top_k           INT            NOT NULL DEFAULT 8,
    threshold       DECIMAL(5,4)   NOT NULL DEFAULT 0.6,
    hybrid_alpha    DECIMAL(5,4)   NOT NULL DEFAULT 0.5,  -- 0=纯 BM25, 1=纯向量
    rerank          BOOLEAN        NOT NULL DEFAULT TRUE,
    rerank_model    VARCHAR(128),
    ontology_filter TEXT,                              -- JSON: {"concept":"Customer","regions":["EAST_CHINA"]}
    updated_at      TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_retrieval UNIQUE (tenant_id, kb_id)
);
