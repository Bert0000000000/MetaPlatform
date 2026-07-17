package com.metaplatform.action.common;

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
    ACTION_NOT_FOUND(40402, HttpStatus.NOT_FOUND, "Action 定义不存在"),
    ORCHESTRATION_NOT_FOUND(40403, HttpStatus.NOT_FOUND, "编排不存在"),
    ORCHESTRATION_EXECUTION_NOT_FOUND(40404, HttpStatus.NOT_FOUND, "编排执行不存在"),
    TRIGGER_NOT_FOUND(40405, HttpStatus.NOT_FOUND, "触发器不存在"),
    STATE_CONFLICT(40901, HttpStatus.CONFLICT, "状态冲突"),
    ALREADY_EXISTS(40902, HttpStatus.CONFLICT, "资源已存在"),
    ACTION_NOT_PUBLISHED(40903, HttpStatus.CONFLICT, "Action 未发布"),
    BUSINESS_RULE_VIOLATION(42201, HttpStatus.UNPROCESSABLE_ENTITY, "业务规则校验失败"),
    CYCLE_DETECTED(42202, HttpStatus.UNPROCESSABLE_ENTITY, "编排节点存在循环依赖"),
    INVALID_GRAPH(42203, HttpStatus.UNPROCESSABLE_ENTITY, "编排节点图非法"),
    RATE_LIMIT_EXCEEDED(42901, HttpStatus.TOO_MANY_REQUESTS, "请求过于频繁"),
    INTERNAL_ERROR(50001, HttpStatus.INTERNAL_SERVER_ERROR, "服务内部错误"),
    HTTP_EXECUTION_ERROR(50003, HttpStatus.INTERNAL_SERVER_ERROR, "Action HTTP 执行失败"),
    EXECUTION_TIMEOUT(50004, HttpStatus.INTERNAL_SERVER_ERROR, "Action 执行超时"),
    DEPENDENCY_ERROR(50005, HttpStatus.INTERNAL_SERVER_ERROR, "依赖服务不可用"),
    RULE_EVALUATION_ERROR(50006, HttpStatus.INTERNAL_SERVER_ERROR, "规则引擎求值失败"),
    COMPENSATION_ERROR(50007, HttpStatus.INTERNAL_SERVER_ERROR, "补偿事务执行失败");

    private final int code;
    private final HttpStatus httpStatus;
    private final String message;
}
