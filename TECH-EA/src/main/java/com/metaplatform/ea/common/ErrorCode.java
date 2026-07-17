package com.metaplatform.ea.common;

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
    PERMISSION_DENIED(40301, HttpStatus.FORBIDDEN, "无权限"),
    NOT_FOUND(40401, HttpStatus.NOT_FOUND, "资源不存在"),
    CAPABILITY_NOT_FOUND(40402, HttpStatus.NOT_FOUND, "业务能力不存在"),
    ROLE_NOT_FOUND(40403, HttpStatus.NOT_FOUND, "业务角色不存在"),
    MAPPING_NOT_FOUND(40404, HttpStatus.NOT_FOUND, "能力概念映射不存在"),
    STATE_CONFLICT(40901, HttpStatus.CONFLICT, "状态冲突"),
    ALREADY_EXISTS(40902, HttpStatus.CONFLICT, "资源已存在"),
    CIRCULAR_REFERENCE(40903, HttpStatus.CONFLICT, "循环引用检测到"),
    BUSINESS_RULE_VIOLATION(42201, HttpStatus.UNPROCESSABLE_ENTITY, "业务规则校验失败"),
    RATE_LIMIT_EXCEEDED(42901, HttpStatus.TOO_MANY_REQUESTS, "请求过于频繁"),
    INTERNAL_ERROR(50001, HttpStatus.INTERNAL_SERVER_ERROR, "服务内部错误"),
    ONT_SERVICE_ERROR(50002, HttpStatus.INTERNAL_SERVER_ERROR, "Ontology 服务调用失败"),
    DEPENDENCY_ERROR(50005, HttpStatus.INTERNAL_SERVER_ERROR, "依赖服务不可用");

    private final int code;
    private final HttpStatus httpStatus;
    private final String message;
}
