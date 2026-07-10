package com.metaplatform.appservice.api.error;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * 统一 API 响应（Sprint 0 起约定）。
 *
 * <pre>
 * 成功：{"code": 0, "data": {...}, "traceId": "uuid"}
 * 失败：{"code": 400, "message": "...", "traceId": "uuid"}
 * </pre>
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ApiResponse<T>(int code, T data, String message, String traceId) {

    public static <T> ApiResponse<T> ok(T data, String traceId) {
        return new ApiResponse<>(0, data, null, traceId);
    }

    public static ApiResponse<Void> error(int code, String message, String traceId) {
        return new ApiResponse<>(code, null, message, traceId);
    }
}
