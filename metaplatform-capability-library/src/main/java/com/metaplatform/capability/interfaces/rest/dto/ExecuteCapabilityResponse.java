package com.metaplatform.capability.interfaces.rest.dto;

import com.metaplatform.capability.domain.CapabilityResult;

import java.util.List;
import java.util.Map;

/**
 * 能力执行响应 DTO。
 */
public record ExecuteCapabilityResponse(
        boolean success,
        String message,
        Map<String, Object> data,
        long executionTimeMs
) {
    public static ExecuteCapabilityResponse from(CapabilityResult result) {
        return new ExecuteCapabilityResponse(
                result.success(),
                result.message(),
                result.data(),
                result.executionTimeMs()
        );
    }
}
