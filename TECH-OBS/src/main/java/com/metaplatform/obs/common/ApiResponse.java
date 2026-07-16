package com.metaplatform.obs.common;

import lombok.Getter;

@Getter
public class ApiResponse<T> {

    private final int code;
    private final String message;
    private final T data;
    private final String traceId;

    private ApiResponse(int code, String message, T data, String traceId) {
        this.code = code;
        this.message = message;
        this.data = data;
        this.traceId = traceId;
    }

    public static <T> ApiResponse<T> success(T data) {
        return new ApiResponse<>(0, "success", data, TraceContext.getOrCreate());
    }

    public static <T> ApiResponse<T> success() {
        return success(null);
    }

    public static <T> ApiResponse<T> error(int code, String message) {
        return new ApiResponse<>(code, message, null, TraceContext.getOrCreate());
    }

    public static <T> ApiResponse<T> error(ErrorCode errorCode) {
        return error(errorCode.getCode(), errorCode.getMessage());
    }
}
