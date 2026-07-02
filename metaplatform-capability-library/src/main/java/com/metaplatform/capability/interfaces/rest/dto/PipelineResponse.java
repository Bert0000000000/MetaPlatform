package com.metaplatform.capability.interfaces.rest.dto;

import com.metaplatform.capability.domain.Pipeline;
import com.metaplatform.capability.domain.PipelineStep;

import java.util.List;

/**
 * 流水线响应 DTO。
 */
public record PipelineResponse(
        String id,
        String name,
        String description,
        List<StepResponse> steps
) {
    public record StepResponse(String capabilityName, int order, String description) {}

    public static PipelineResponse from(Pipeline pipeline) {
        return new PipelineResponse(
                pipeline.id().value(),
                pipeline.name(),
                pipeline.description(),
                pipeline.steps().stream()
                        .map(s -> new StepResponse(s.capabilityName(), s.order(), s.description()))
                        .toList()
        );
    }
}
