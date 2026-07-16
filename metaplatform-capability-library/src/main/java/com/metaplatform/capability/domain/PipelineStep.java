package com.metaplatform.capability.domain;

import java.util.Objects;

/**
 * 流水线步骤。定义流水线中单个能力调用的配置。
 */
public record PipelineStep(
        String capabilityName,
        int order,
        String description
) {
    public PipelineStep {
        if (capabilityName == null || capabilityName.isBlank()) {
            throw new IllegalArgumentException("PipelineStep capabilityName must not be blank");
        }
        if (order < 0) {
            throw new IllegalArgumentException("PipelineStep order must be non-negative");
        }
    }
}
