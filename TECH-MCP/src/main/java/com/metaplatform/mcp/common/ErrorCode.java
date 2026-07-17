package com.metaplatform.mcp.common;

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
    SERVER_NOT_FOUND(40402, HttpStatus.NOT_FOUND, "MCP Server 不存在"),
    TOOL_NOT_FOUND(40403, HttpStatus.NOT_FOUND, "MCP Tool 不存在"),
    CLIENT_NOT_FOUND(40404, HttpStatus.NOT_FOUND, "MCP Client 不存在"),
    EXECUTION_NOT_FOUND(40405, HttpStatus.NOT_FOUND, "执行记录不存在"),
    RESOURCE_NOT_FOUND(40406, HttpStatus.NOT_FOUND, "MCP Resource 不存在"),
    PROMPT_TEMPLATE_NOT_FOUND(40407, HttpStatus.NOT_FOUND, "Prompt 模板不存在"),
    AUDIT_LOG_NOT_FOUND(40408, HttpStatus.NOT_FOUND, "审计日志不存在"),
    EVENT_SUBSCRIPTION_NOT_FOUND(40409, HttpStatus.NOT_FOUND, "事件订阅不存在"),
    POSITION_NOT_FOUND(40410, HttpStatus.NOT_FOUND, "岗位不存在"),
    STATE_CONFLICT(40901, HttpStatus.CONFLICT, "状态冲突"),
    ALREADY_EXISTS(40902, HttpStatus.CONFLICT, "资源已存在"),
    TOOL_NOT_ENABLED(40903, HttpStatus.CONFLICT, "Tool 未启用"),
    SERVER_NOT_ACTIVE(40904, HttpStatus.CONFLICT, "MCP Server 未激活"),
    BUSINESS_RULE_VIOLATION(42201, HttpStatus.UNPROCESSABLE_ENTITY, "业务规则校验失败"),
    RATE_LIMIT_EXCEEDED(42901, HttpStatus.TOO_MANY_REQUESTS, "请求过于频繁"),
    INTERNAL_ERROR(50001, HttpStatus.INTERNAL_SERVER_ERROR, "服务内部错误"),
    TOOL_EXECUTION_ERROR(50003, HttpStatus.INTERNAL_SERVER_ERROR, "Tool 执行失败"),
    EXECUTION_TIMEOUT(50004, HttpStatus.INTERNAL_SERVER_ERROR, "Tool 执行超时"),
    DEPENDENCY_ERROR(50005, HttpStatus.INTERNAL_SERVER_ERROR, "依赖服务不可用"),
    JSONRPC_ERROR(50006, HttpStatus.INTERNAL_SERVER_ERROR, "JSON-RPC 协议错误"),
    CLIENT_CONNECTION_ERROR(50007, HttpStatus.INTERNAL_SERVER_ERROR, "MCP Client 连接失败"),
    DISCOVERY_ERROR(50008, HttpStatus.INTERNAL_SERVER_ERROR, "MCP 发现失败");

    private final int code;
    private final HttpStatus httpStatus;
    private final String message;
}
