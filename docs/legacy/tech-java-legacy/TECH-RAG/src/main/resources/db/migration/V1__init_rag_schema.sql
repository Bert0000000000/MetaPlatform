CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS rag_knowledge_base (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    embedding_model VARCHAR(255) NOT NULL DEFAULT 'text-embedding-v3',
    retrieval_config JSONB NOT NULL DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rag_kb_created_by ON rag_knowledge_base(created_by);
CREATE INDEX IF NOT EXISTS idx_rag_kb_is_active ON rag_knowledge_base(is_active);

CREATE TABLE IF NOT EXISTS rag_document (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    kb_id UUID NOT NULL REFERENCES rag_knowledge_base(id) ON DELETE CASCADE,
    title VARCHAR(500),
    file_name VARCHAR(500) NOT NULL,
    file_size BIGINT,
    file_type VARCHAR(100),
    file_path VARCHAR(1000),
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    chunk_count INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_rag_document_status CHECK (status IN ('pending', 'processing', 'completed', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_rag_document_kb_id ON rag_document(kb_id);
CREATE INDEX IF NOT EXISTS idx_rag_document_status ON rag_document(status);
CREATE INDEX IF NOT EXISTS idx_rag_document_file_name ON rag_document(file_name);

CREATE TABLE IF NOT EXISTS rag_chunk (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    doc_id UUID NOT NULL REFERENCES rag_document(id) ON DELETE CASCADE,
    kb_id UUID NOT NULL REFERENCES rag_knowledge_base(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    vector_id VARCHAR(255),
    metadata JSONB NOT NULL DEFAULT '{}',
    sequence INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rag_chunk_doc_id ON rag_chunk(doc_id);
CREATE INDEX IF NOT EXISTS idx_rag_chunk_kb_id ON rag_chunk(kb_id);
CREATE INDEX IF NOT EXISTS idx_rag_chunk_vector_id ON rag_chunk(vector_id);

CREATE TABLE IF NOT EXISTS rag_search_feedback (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    query TEXT NOT NULL,
    kb_id UUID REFERENCES rag_knowledge_base(id) ON DELETE SET NULL,
    chunk_id UUID REFERENCES rag_chunk(id) ON DELETE SET NULL,
    score DOUBLE PRECISION,
    feedback_type VARCHAR(50) NOT NULL,
    comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_rag_feedback_type CHECK (feedback_type IN ('like', 'dislike'))
);

CREATE INDEX IF NOT EXISTS idx_rag_search_feedback_kb_id ON rag_search_feedback(kb_id);
CREATE INDEX IF NOT EXISTS idx_rag_search_feedback_chunk_id ON rag_search_feedback(chunk_id);
CREATE INDEX IF NOT EXISTS idx_rag_search_feedback_type ON rag_search_feedback(feedback_type);
