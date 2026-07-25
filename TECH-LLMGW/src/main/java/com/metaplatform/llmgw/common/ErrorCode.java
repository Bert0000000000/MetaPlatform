package com.metaplatform.llmgw.common;

public enum ErrorCode {
    BAD_REQUEST(400),
    UNAUTHORIZED(401),
    FORBIDDEN(403),
    NOT_FOUND(404),
    RATE_LIMITED(429),
    INTERNAL_ERROR(500),
    MODEL_UNAVAILABLE(503),
    QUOTA_EXCEEDED(429);

    private final int httpStatus;
    ErrorCode(int httpStatus) { this.httpStatus = httpStatus; }
    public int getHttpStatus() { return httpStatus; }
}
