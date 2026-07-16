package com.metaplatform.iam.common;

import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;

@Getter
@RequiredArgsConstructor
public enum ErrorCode {

    SUCCESS(0, HttpStatus.OK, "success"),
    INVALID_PARAM(40001, HttpStatus.BAD_REQUEST, "参数校验失败"),
    INVALID_FIELD_VALUE(40002, HttpStatus.BAD_REQUEST, "参数值非法"),
    UNAUTHORIZED(40101, HttpStatus.UNAUTHORIZED, "未认证"),
    INVALID_CREDENTIALS(40102, HttpStatus.UNAUTHORIZED, "用户名或密码错误"),
    TOKEN_EXPIRED(40103, HttpStatus.UNAUTHORIZED, "Token 已过期"),
    MFA_REQUIRED(40104, HttpStatus.UNAUTHORIZED, "多因素认证未完成"),
    API_KEY_INVALID(40105, HttpStatus.UNAUTHORIZED, "API Key 无效"),
    PERMISSION_DENIED(40301, HttpStatus.FORBIDDEN, "无权限"),
    ACCOUNT_DISABLED(40302, HttpStatus.FORBIDDEN, "账户已被禁用"),
    ACCOUNT_LOCKED(40303, HttpStatus.FORBIDDEN, "账户已被锁定"),
    NOT_FOUND(40401, HttpStatus.NOT_FOUND, "资源不存在"),
    USER_NOT_FOUND(40401, HttpStatus.NOT_FOUND, "用户不存在"),
    STATE_CONFLICT(40901, HttpStatus.CONFLICT, "状态冲突"),
    VERSION_CONFLICT(40902, HttpStatus.CONFLICT, "版本冲突"),
    USER_ALREADY_EXISTS(40903, HttpStatus.CONFLICT, "用户已存在"),
    BUSINESS_RULE_VIOLATION(42201, HttpStatus.UNPROCESSABLE_ENTITY, "业务规则校验失败"),
    RATE_LIMIT_EXCEEDED(42901, HttpStatus.TOO_MANY_REQUESTS, "请求过于频繁"),
    INTERNAL_ERROR(50001, HttpStatus.INTERNAL_SERVER_ERROR, "服务内部错误"),
    DEPENDENCY_ERROR(50002, HttpStatus.INTERNAL_SERVER_ERROR, "依赖服务不可用"),
    SECURITY_ERROR(50003, HttpStatus.INTERNAL_SERVER_ERROR, "安全策略异常");

    private final int code;
    private final HttpStatus httpStatus;
    private final String message;
}
