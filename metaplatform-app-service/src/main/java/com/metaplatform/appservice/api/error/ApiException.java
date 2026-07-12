package com.metaplatform.appservice.api.error;

import org.springframework.http.HttpStatus;

/**
 * 业务异常 —— 携带 HTTP 状态码的统一封装。
 * 由 {@link GlobalExceptionHandler} 转成标准 {@link ApiResponse}。
 */
public class ApiException extends RuntimeException {
    private final HttpStatus status;
    private final int code;

    public ApiException(HttpStatus status, int code, String message) {
        super(message);
        this.status = status;
        this.code = code;
    }

    public HttpStatus getStatus() { return status; }
    public int getCode() { return code; }

    public static ApiException badRequest(String message) {
        return new ApiException(HttpStatus.BAD_REQUEST, 400, message);
    }
    public static ApiException notFound(String message) {
        return new ApiException(HttpStatus.NOT_FOUND, 404, message);
    }
    public static ApiException conflict(String message) {
        return new ApiException(HttpStatus.CONFLICT, 409, message);
    }
    public static ApiException forbidden(String message) {
        return new ApiException(HttpStatus.FORBIDDEN, 403, message);
    }
    public static ApiException internalError(String message) {
        return new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, 500, message);
    }
}
