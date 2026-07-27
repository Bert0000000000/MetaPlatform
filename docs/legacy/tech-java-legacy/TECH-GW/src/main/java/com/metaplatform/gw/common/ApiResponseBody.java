package com.metaplatform.gw.common;

import lombok.Getter;

/**
 * Body wrapper for API responses. We intentionally keep this separate from data DTOs named "ApiResponse"
 * (e.g. {@link com.metaplatform.gw.api.dto.ApiResponse}) so package-level imports stay explicit.
 */
@Getter
public class ApiResponseBody<T> {

    private final int code;
    private final String message;
    private final T data;
    private final String traceId;

    private ApiResponseBody(int code, String message, T data, String traceId) {
        this.code = code;
        this.message = message;
        this.data = data;
        this.traceId = traceId;
    }

    public static <T> ApiResponseBody<T> success(T data) {
        return new ApiResponseBody<>(0, "success", data, TraceContext.getOrCreate());
    }

    public static <T> ApiResponseBody<T> success() {
        return success(null);
    }

    public static <T> ApiResponseBody<T> error(int code, String message) {
        return new ApiResponseBody<>(code, message, null, TraceContext.getOrCreate());
    }
}
