package com.metaplatform.action.execution.dto;

/**
 * 中止执行请求。
 */
public record AbortExecutionRequest(
        Boolean withCompensation
) {
}
