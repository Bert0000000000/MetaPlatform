package com.metaplatform.rule.common;

import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;

@Getter
@RequiredArgsConstructor
public enum ErrorCode {

    SUCCESS(0, HttpStatus.OK, "success"),
    INVALID_PARAM(40001, HttpStatus.BAD_REQUEST, "参数校验失败"),
    INVALID_FIELD_VALUE(40002, HttpStatus.BAD_REQUEST, "字段值不合法"),
    UNAUTHORIZED(40101, HttpStatus.UNAUTHORIZED, "未认证"),
    TOKEN_EXPIRED(40102, HttpStatus.UNAUTHORIZED, "Token 已过期"),
    TOKEN_INVALID(40103, HttpStatus.UNAUTHORIZED, "Token 无效"),
    PERMISSION_DENIED(40301, HttpStatus.FORBIDDEN, "权限不足"),
    TENANT_MISMATCH(40302, HttpStatus.FORBIDDEN, "租户不匹配"),
    RULESET_NOT_FOUND(40401, HttpStatus.NOT_FOUND, "规则集不存在"),
    RULE_NOT_FOUND(40402, HttpStatus.NOT_FOUND, "规则不存在"),
    RULESET_ALREADY_EXISTS(40901, HttpStatus.CONFLICT, "规则集已存在"),
    RULE_ALREADY_EXISTS(40902, HttpStatus.CONFLICT, "规则已存在"),
    RULESET_HAS_RULES(42201, HttpStatus.UNPROCESSABLE_ENTITY, "规则集下存在规则，无法删除"),
    RULE_EXECUTION_FAILED(42202, HttpStatus.UNPROCESSABLE_ENTITY, "规则执行失败"),
    ONTOLOGY_REFERENCE_INVALID(42203, HttpStatus.UNPROCESSABLE_ENTITY, "本体引用校验失败"),
    INTERNAL_ERROR(50001, HttpStatus.INTERNAL_SERVER_ERROR, "服务内部错误"),
    DATABASE_ERROR(50002, HttpStatus.INTERNAL_SERVER_ERROR, "数据库操作失败"),
    DEPENDENCY_ERROR(50003, HttpStatus.INTERNAL_SERVER_ERROR, "依赖服务不可用");

    private final int code;
    private final HttpStatus httpStatus;
    private final String message;
}
