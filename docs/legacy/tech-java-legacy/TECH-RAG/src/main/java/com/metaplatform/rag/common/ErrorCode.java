package com.metaplatform.rag.common;

public enum ErrorCode {
    BAD_REQUEST(400),
    UNAUTHORIZED(401),
    FORBIDDEN(403),
    NOT_FOUND(404),
    RATE_LIMITED(429),
    INTERNAL_ERROR(500),
    SERVICE_UNAVAILABLE(503),
    KNOWLEDGE_BASE_NOT_FOUND(404),
    DOCUMENT_NOT_FOUND(404),
    CHUNK_NOT_FOUND(404),
    EMBEDDING_FAILED(500),
    VECTOR_STORE_ERROR(500);

    private final int httpStatus;
    ErrorCode(int httpStatus) { this.httpStatus = httpStatus; }
    public int getHttpStatus() { return httpStatus; }
}
