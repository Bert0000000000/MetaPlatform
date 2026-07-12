package com.metaplatform.appservice.api.error;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * 统一 API 响应（兼容前端 request 契约）。
 *
 * <pre>
 * 成功：{"success": true, "code": 0, "data": {...}, "traceId": "uuid"}
 * 失败：{"success": false, "code": 400, "error": "...", "traceId": "uuid"}
 * </pre>
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ApiResponse<T>(boolean success, T data, String error, Integer code, String traceId) {

    public static <T> ApiResponse<T> ok(T data, String traceId) {
        return new ApiResponse<>(true, data, null, 0, traceId);
    }

    public static ApiResponse<Void> error(int code, String message, String traceId) {
        return new ApiResponse<>(false, null, message, code, traceId);
    }
}
