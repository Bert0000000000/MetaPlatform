package com.metaplatform.capability.interfaces.rest.dto;

import com.metaplatform.capability.domain.PipelineStep;

import java.util.List;

/**
 * 创建流水线请求。
 */
public record CreatePipelineRequest(
        String name,
        String description,
        List<StepSpec> steps
) {
    public record StepSpec(String capabilityName, int order, String description) {}
}
