package com.metaplatform.wfe.common;

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
    PROCESS_DEFINITION_NOT_FOUND(40401, HttpStatus.NOT_FOUND, "流程定义不存在"),
    PROCESS_INSTANCE_NOT_FOUND(40402, HttpStatus.NOT_FOUND, "流程实例不存在"),
    TASK_NOT_FOUND(40403, HttpStatus.NOT_FOUND, "任务不存在"),
    PROCESS_DEFINITION_ALREADY_EXISTS(40901, HttpStatus.CONFLICT, "流程定义已存在"),
    VERSION_CONFLICT(40902, HttpStatus.CONFLICT, "版本冲突"),
    STATE_CONFLICT(40903, HttpStatus.CONFLICT, "状态冲突，操作与当前资源状态不兼容"),
    BPMN_PARSE_FAILED(42201, HttpStatus.UNPROCESSABLE_ENTITY, "BPMN XML 解析失败"),
    PROCESS_EXECUTION_FAILED(42202, HttpStatus.UNPROCESSABLE_ENTITY, "流程执行失败"),
    INTERNAL_ERROR(50001, HttpStatus.INTERNAL_SERVER_ERROR, "服务内部错误"),
    DATABASE_ERROR(50002, HttpStatus.INTERNAL_SERVER_ERROR, "数据库操作失败"),
    DEPENDENCY_ERROR(50003, HttpStatus.INTERNAL_SERVER_ERROR, "依赖服务不可用");

    private final int code;
    private final HttpStatus httpStatus;
    private final String message;
}
