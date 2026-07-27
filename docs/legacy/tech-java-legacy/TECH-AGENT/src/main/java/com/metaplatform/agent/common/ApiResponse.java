package com.metaplatform.agent.common;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * 统一 API 响应封装。
 *
 * <p>所有 Controller 返回此对象，由全局异常处理器统一包装错误响应。
 * 字段命名遵循前端约定：{@code code / message / data / traceId}。</p>
 *
 * @param <T> 业务数据类型
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ApiResponse<T> {

    /** 业务错误码，0 表示成功。 */
    private Integer code;

    /** 提示信息。 */
    private String message;

    /** 业务数据。 */
    private T data;

    /** 链路追踪 ID。 */
    private String traceId;

    /**
     * 构造成功响应（无数据）。
     */
    public static <T> ApiResponse<T> success() {
        return success(null);
    }

    /**
     * 构造成功响应（带数据，自动注入当前 traceId）。
     */
    public static <T> ApiResponse<T> success(T data) {
        return new ApiResponse<>(ErrorCode.SUCCESS.getCode(),
                ErrorCode.SUCCESS.getDefaultMessage(),
                data,
                TenantContext.getTraceId());
    }

    /**
     * 构造错误响应（自动注入当前 traceId）。
     */
    public static <T> ApiResponse<T> error(ErrorCode errorCode) {
        return error(errorCode, errorCode.getDefaultMessage());
    }

    /**
     * 构造错误响应（自定义 message）。
     */
    public static <T> ApiResponse<T> error(ErrorCode errorCode, String message) {
        return new ApiResponse<>(errorCode.getCode(), message, null, TenantContext.getTraceId());
    }

    /**
     * 构造错误响应（自定义 code 与 message）。
     */
    public static <T> ApiResponse<T> error(int code, String message) {
        return new ApiResponse<>(code, message, null, TenantContext.getTraceId());
    }

    /**
     * 判断是否成功。
     */
    public boolean isSuccess() {
        return code != null && code == ErrorCode.SUCCESS.getCode();
    }
}
