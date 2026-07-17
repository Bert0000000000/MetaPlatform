package com.metaplatform.msg.common;

import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;

@Getter
@RequiredArgsConstructor
public enum ErrorCode {

    SUCCESS(0, HttpStatus.OK, "success"),
    INVALID_PARAM(40001, HttpStatus.BAD_REQUEST, "参数校验失败"),
    NOT_FOUND(40401, HttpStatus.NOT_FOUND, "资源不存在"),
    OUTBOX_NOT_FOUND(40402, HttpStatus.NOT_FOUND, "Outbox 消息不存在"),
    CONSUMER_GROUP_NOT_FOUND(40403, HttpStatus.NOT_FOUND, "消费者组不存在"),
    DLQ_MESSAGE_NOT_FOUND(40404, HttpStatus.NOT_FOUND, "DLQ 消息不存在"),
    DLQ_POLICY_NOT_FOUND(40405, HttpStatus.NOT_FOUND, "DLQ 重试策略不存在"),
    STATE_CONFLICT(40901, HttpStatus.CONFLICT, "状态冲突"),
    CONSUMER_GROUP_ALREADY_EXISTS(40902, HttpStatus.CONFLICT, "消费者组已存在"),
    DLQ_MAX_RETRIES_EXCEEDED(40903, HttpStatus.CONFLICT, "DLQ 消息重试次数已达上限"),
    BUSINESS_RULE_VIOLATION(42201, HttpStatus.UNPROCESSABLE_ENTITY, "业务规则校验失败"),
    INTERNAL_ERROR(50001, HttpStatus.INTERNAL_SERVER_ERROR, "服务内部错误"),
    KAFKA_ERROR(50002, HttpStatus.INTERNAL_SERVER_ERROR, "Kafka 操作失败");

    private final int code;
    private final HttpStatus httpStatus;
    private final String message;
}
