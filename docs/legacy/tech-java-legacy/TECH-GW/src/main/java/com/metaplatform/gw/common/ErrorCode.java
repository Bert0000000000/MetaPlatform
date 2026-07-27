package com.metaplatform.gw.common;

import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;

@Getter
@RequiredArgsConstructor
public enum ErrorCode {

    SUCCESS(0, HttpStatus.OK, "success"),
    INVALID_PARAM(40001, HttpStatus.BAD_REQUEST, "参数校验失败"),
    INVALID_FIELD_VALUE(40002, HttpStatus.BAD_REQUEST, "参数值非法"),
    UNSUPPORTED_LIMIT_TYPE(40007, HttpStatus.BAD_REQUEST, "不支持的限流类型"),
    UNAUTHORIZED(40101, HttpStatus.UNAUTHORIZED, "未认证或Token已过期"),
    INVALID_CREDENTIALS(40102, HttpStatus.UNAUTHORIZED, "用户名或密码错误"),
    TOKEN_EXPIRED(40103, HttpStatus.UNAUTHORIZED, "Token 已过期"),
    PERMISSION_DENIED(40301, HttpStatus.FORBIDDEN, "无权限"),
    NOT_FOUND(40401, HttpStatus.NOT_FOUND, "资源不存在"),
    ROUTE_NOT_FOUND(40402, HttpStatus.NOT_FOUND, "路由不存在"),
    RATE_LIMIT_NOT_FOUND(40403, HttpStatus.NOT_FOUND, "限流规则不存在"),
    STATE_CONFLICT(40901, HttpStatus.CONFLICT, "状态冲突"),
    ROUTE_ALREADY_EXISTS(40902, HttpStatus.CONFLICT, "路由已存在"),
    RATE_LIMIT_ALREADY_EXISTS(40903, HttpStatus.CONFLICT, "限流规则已存在"),
    VERSION_MISMATCH(40908, HttpStatus.CONFLICT, "版本号不匹配"),
    BUSINESS_RULE_VIOLATION(42201, HttpStatus.UNPROCESSABLE_ENTITY, "业务规则校验失败"),
    RATE_LIMIT_EXCEEDED(42901, HttpStatus.TOO_MANY_REQUESTS, "请求过于频繁"),
    INTERNAL_ERROR(50001, HttpStatus.INTERNAL_SERVER_ERROR, "服务内部错误"),
    DEPENDENCY_ERROR(50002, HttpStatus.INTERNAL_SERVER_ERROR, "依赖服务不可用"),
    RATE_LIMIT_REDIS_ERROR(50003, HttpStatus.INTERNAL_SERVER_ERROR, "限流计数器Redis操作失败");

    private final int code;
    private final HttpStatus httpStatus;
    private final String message;
}
