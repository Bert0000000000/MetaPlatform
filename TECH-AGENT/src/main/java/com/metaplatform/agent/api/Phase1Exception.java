package com.metaplatform.agent.api;

import lombok.Getter;
import org.springframework.http.HttpStatus;

@Getter
public class Phase1Exception extends RuntimeException {
    private final String errorCode;
    private final HttpStatus status;
    private final Integer retryAfterSeconds;
    private final String userActionHint;

    public Phase1Exception(String errorCode, HttpStatus status, String message) {
        this(errorCode, status, message, null, null);
    }
    public Phase1Exception(String errorCode, HttpStatus status, String message, Integer retryAfterSeconds, String userActionHint) {
        super(message);
        this.errorCode = errorCode;
        this.status = status;
        this.retryAfterSeconds = retryAfterSeconds;
        this.userActionHint = userActionHint;
    }
    public static Phase1Exception badRequest(String code, String message) { return new Phase1Exception(code, HttpStatus.BAD_REQUEST, message); }
    public static Phase1Exception forbidden(String code, String message) { return new Phase1Exception(code, HttpStatus.FORBIDDEN, message); }
    public static Phase1Exception notFound(String code, String message) { return new Phase1Exception(code, HttpStatus.NOT_FOUND, message); }
    public static Phase1Exception conflict(String code, String message) { return new Phase1Exception(code, HttpStatus.CONFLICT, message); }
    public static Phase1Exception gone(String code, String message) { return new Phase1Exception(code, HttpStatus.GONE, message); }
}
