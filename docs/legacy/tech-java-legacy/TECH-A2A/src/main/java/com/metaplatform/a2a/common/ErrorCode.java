package com.metaplatform.a2a.common;

import lombok.Getter;

/**
 * TECH-A2A 业务错误码枚举。
 *
 * <p>对应 Python {@code app.common.errors.ErrorCode}。
 * 错误码与 HTTP 状态一一对应，由 {@link com.metaplatform.a2a.exception.GlobalExceptionHandler}
 * 统一翻译为 HTTP 响应。</p>
 */
@Getter
public enum ErrorCode {

    SUCCESS(0, 200, "success"),

    // 4xx 客户端错误
    INVALID_PARAM(40001, 400, "无效参数"),
    MISSING_REQUIRED_FIELD(40003, 400, "缺少必填字段"),
    INVALID_FIELD_VALUE(40004, 400, "字段值无效"),
    UNAUTHORIZED(40101, 401, "未授权"),
    FORBIDDEN(40301, 403, "禁止访问"),
    TENANT_MISMATCH(40302, 403, "租户不匹配"),
    AGENT_NOT_FOUND(40401, 404, "Agent 不存在"),
    TASK_NOT_FOUND(40402, 404, "任务不存在"),
    MESSAGE_NOT_FOUND(40403, 404, "消息不存在"),
    CARD_NOT_FOUND(40404, 404, "Agent Card 不存在"),
    KEY_NOT_FOUND(40405, 404, "API Key 不存在"),
    DUPLICATE_AGENT_CARD(40901, 409, "Agent Card 名称已存在"),
    AGENT_ALREADY_REGISTERED(40902, 409, "Agent 已注册"),
    TASK_ALREADY_COMPLETED(40903, 409, "任务已终态"),
    INVALID_REQUEST(42200, 422, "请求语义错误"),

    // 5xx 服务端错误
    INTERNAL_ERROR(50001, 500, "服务内部错误"),
    UPSTREAM_UNAVAILABLE(50002, 503, "上游服务不可用");

    /** 业务错误码（用于响应体 code 字段）。 */
    private final int code;

    /** 对应 HTTP 状态码。 */
    private final int httpStatus;

    /** 默认错误描述。 */
    private final String defaultMessage;

    ErrorCode(int code, int httpStatus, String defaultMessage) {
        this.code = code;
        this.httpStatus = httpStatus;
        this.defaultMessage = defaultMessage;
    }
}
