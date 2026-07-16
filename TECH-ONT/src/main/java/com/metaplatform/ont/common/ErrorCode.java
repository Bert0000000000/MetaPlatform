package com.metaplatform.ont.common;

import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;

@Getter
@RequiredArgsConstructor
public enum ErrorCode {

    SUCCESS(0, HttpStatus.OK, "success"),
    INVALID_PARAM(40001, HttpStatus.BAD_REQUEST, "参数校验失败"),
    INVALID_JSON(40002, HttpStatus.BAD_REQUEST, "请求体 JSON 格式错误"),
    MISSING_REQUIRED_FIELD(40003, HttpStatus.BAD_REQUEST, "缺少必填字段"),
    INVALID_FIELD_VALUE(40004, HttpStatus.BAD_REQUEST, "字段值不合法"),
    TOKEN_EXPIRED(40101, HttpStatus.UNAUTHORIZED, "Token 已过期"),
    TOKEN_INVALID(40102, HttpStatus.UNAUTHORIZED, "Token 无效"),
    API_KEY_INVALID(40103, HttpStatus.UNAUTHORIZED, "API Key 无效"),
    PERMISSION_DENIED(40301, HttpStatus.FORBIDDEN, "权限不足"),
    TENANT_MISMATCH(40302, HttpStatus.FORBIDDEN, "租户不匹配"),
    CONCEPT_NOT_FOUND(40401, HttpStatus.NOT_FOUND, "概念不存在"),
    ENTITY_NOT_FOUND(40402, HttpStatus.NOT_FOUND, "实体不存在"),
    RELATION_NOT_FOUND(40403, HttpStatus.NOT_FOUND, "关系不存在"),
    ATTRIBUTE_NOT_FOUND(40404, HttpStatus.NOT_FOUND, "属性不存在"),
    RULE_NOT_FOUND(40405, HttpStatus.NOT_FOUND, "规则不存在"),
    VERSION_NOT_FOUND(40406, HttpStatus.NOT_FOUND, "版本不存在"),
    TASK_NOT_FOUND(40407, HttpStatus.NOT_FOUND, "任务不存在"),
    CONCEPT_ALREADY_EXISTS(40901, HttpStatus.CONFLICT, "概念已存在"),
    ENTITY_ALREADY_EXISTS(40902, HttpStatus.CONFLICT, "实体已存在"),
    RELATION_ALREADY_EXISTS(40903, HttpStatus.CONFLICT, "关系已存在"),
    ATTRIBUTE_ALREADY_EXISTS(40904, HttpStatus.CONFLICT, "属性已存在"),
    RULE_ALREADY_EXISTS(40905, HttpStatus.CONFLICT, "规则已存在"),
    VERSION_CONFLICT(40906, HttpStatus.CONFLICT, "版本并发冲突"),
    CYCLIC_INHERITANCE(40907, HttpStatus.CONFLICT, "概念继承存在环"),
    CONCEPT_HAS_ENTITIES(42201, HttpStatus.UNPROCESSABLE_ENTITY, "概念下存在实体，无法删除"),
    CONCEPT_HAS_CHILDREN(42202, HttpStatus.UNPROCESSABLE_ENTITY, "概念下存在子概念，无法删除"),
    ATTRIBUTE_CONSTRAINT_VIOLATION(42203, HttpStatus.UNPROCESSABLE_ENTITY, "属性约束校验失败"),
    RULE_EXECUTION_FAILED(42204, HttpStatus.UNPROCESSABLE_ENTITY, "规则执行失败"),
    INFERENCE_INCONSISTENCY(42205, HttpStatus.UNPROCESSABLE_ENTITY, "本体推理发现不一致"),
    VERSION_NOT_PUBLISHED(42206, HttpStatus.UNPROCESSABLE_ENTITY, "版本未发布，无法回滚"),
    RELATION_CONSTRAINT_VIOLATION(42207, HttpStatus.UNPROCESSABLE_ENTITY, "关系约束校验失败"),
    RATE_LIMIT_EXCEEDED(42901, HttpStatus.TOO_MANY_REQUESTS, "限流触发"),
    INTERNAL_ERROR(50001, HttpStatus.INTERNAL_SERVER_ERROR, "服务内部错误"),
    DATABASE_ERROR(50002, HttpStatus.INTERNAL_SERVER_ERROR, "数据库操作失败"),
    NEO4J_ERROR(50003, HttpStatus.INTERNAL_SERVER_ERROR, "图数据库操作失败"),
    INFERENCE_ENGINE_ERROR(50004, HttpStatus.INTERNAL_SERVER_ERROR, "推理引擎异常"),
    KAFKA_PUBLISH_FAILED(50005, HttpStatus.INTERNAL_SERVER_ERROR, "Kafka 消息发布失败"),
    SERVICE_UNAVAILABLE(50301, HttpStatus.SERVICE_UNAVAILABLE, "服务暂不可用");

    private final int code;
    private final HttpStatus httpStatus;
    private final String message;
}
