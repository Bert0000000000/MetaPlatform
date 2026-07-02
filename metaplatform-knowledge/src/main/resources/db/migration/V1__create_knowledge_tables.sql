-- Knowledge Base
CREATE TABLE knowledge_base (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    type VARCHAR(20) NOT NULL DEFAULT 'RAG',
    chunk_size INT DEFAULT 512,
    chunk_overlap INT DEFAULT 50,
    embedding_model VARCHAR(100) DEFAULT 'text-embedding-3-small',
    document_count BIGINT DEFAULT 0,
    chunk_count BIGINT DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_by VARCHAR(100),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Document
CREATE TABLE document (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    file_name VARCHAR(500) NOT NULL,
    file_type VARCHAR(20) NOT NULL,
    file_size BIGINT,
    knowledge_base_id BIGINT REFERENCES knowledge_base(id) ON DELETE SET NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'UPLOADED',
    raw_content TEXT,
    storage_path VARCHAR(1000),
    metadata_json TEXT,
    version INT DEFAULT 1,
    previous_version_id BIGINT REFERENCES document(id),
    created_by VARCHAR(100),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Document Chunk
CREATE TABLE document_chunk (
    id BIGSERIAL PRIMARY KEY,
    document_id BIGINT NOT NULL REFERENCES document(id) ON DELETE CASCADE,
    chunk_index INT NOT NULL,
    content TEXT NOT NULL,
    start_position INT,
    end_position INT,
    embedding_json TEXT,
    vector_id VARCHAR(200),
    metadata_json TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Document Metadata
CREATE TABLE document_metadata (
    id BIGSERIAL PRIMARY KEY,
    document_id BIGINT NOT NULL REFERENCES document(id) ON DELETE CASCADE,
    author VARCHAR(200),
    category VARCHAR(100),
    tags TEXT,
    language VARCHAR(20),
    source VARCHAR(200),
    published_at TIMESTAMP,
    custom_metadata TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Golden Record (MDM)
CREATE TABLE golden_record (
    id BIGSERIAL PRIMARY KEY,
    entity_type VARCHAR(100) NOT NULL,
    entity_code VARCHAR(200) NOT NULL UNIQUE,
    data_json TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    match_score INT DEFAULT 100,
    source_count INT DEFAULT 1,
    merge_strategy VARCHAR(30) DEFAULT 'MASTER_WINS',
    created_by VARCHAR(100),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Record Link (MDM)
CREATE TABLE record_link (
    id BIGSERIAL PRIMARY KEY,
    golden_record_id BIGINT NOT NULL REFERENCES golden_record(id) ON DELETE CASCADE,
    source_system VARCHAR(100) NOT NULL,
    source_id VARCHAR(200) NOT NULL,
    source_data TEXT,
    match_score INT,
    match_rule VARCHAR(50),
    linked_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_doc_kb ON document(knowledge_base_id);
CREATE INDEX idx_doc_status ON document(status);
CREATE INDEX idx_chunk_doc ON document_chunk(document_id);
CREATE INDEX idx_chunk_vector ON document_chunk(vector_id);
CREATE INDEX idx_metadata_doc ON document_metadata(document_id);
CREATE INDEX idx_golden_entity ON golden_record(entity_type, status);
CREATE INDEX idx_golden_code ON golden_record(entity_code);
CREATE INDEX idx_link_golden ON record_link(golden_record_id);
CREATE INDEX idx_link_source ON record_link(source_system, source_id);
