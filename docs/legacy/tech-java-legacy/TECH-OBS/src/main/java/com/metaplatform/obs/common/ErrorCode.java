package com.metaplatform.obs.common;

import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;

@Getter
@RequiredArgsConstructor
public enum ErrorCode {

    SUCCESS(0, HttpStatus.OK, "success"),
    INVALID_PARAM(40001, HttpStatus.BAD_REQUEST, "参数校验失败"),
    MISSING_REQUIRED_FIELD(40003, HttpStatus.BAD_REQUEST, "缺少必填字段"),
    INVALID_FIELD_VALUE(40004, HttpStatus.BAD_REQUEST, "字段值不合法"),
    INVALID_TIME_RANGE(40005, HttpStatus.BAD_REQUEST, "时间范围不合法"),
    TOKEN_INVALID(40102, HttpStatus.UNAUTHORIZED, "Token 无效"),
    PERMISSION_DENIED(40301, HttpStatus.FORBIDDEN, "权限不足"),
    LOG_NOT_FOUND(40401, HttpStatus.NOT_FOUND, "日志不存在"),
    ANOMALY_NOT_FOUND(40402, HttpStatus.NOT_FOUND, "异常事件不存在"),
    ANOMALY_RULE_NOT_FOUND(40403, HttpStatus.NOT_FOUND, "异常检测规则不存在"),
    QUERY_TIMEOUT(50401, HttpStatus.GATEWAY_TIMEOUT, "查询执行超时"),
    INTERNAL_ERROR(50001, HttpStatus.INTERNAL_SERVER_ERROR, "服务内部错误"),
    LOKI_UNAVAILABLE(50301, HttpStatus.SERVICE_UNAVAILABLE, "Loki 下游不可用"),
    SERVICE_UNAVAILABLE(50302, HttpStatus.SERVICE_UNAVAILABLE, "服务暂不可用");

    private final int code;
    private final HttpStatus httpStatus;
    private final String message;
}
