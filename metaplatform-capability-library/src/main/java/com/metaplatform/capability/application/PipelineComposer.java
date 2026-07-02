package com.metaplatform.capability.application;

import com.metaplatform.capability.domain.*;
import com.metaplatform.capability.infrastructure.memory.InMemoryPipelineRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * 流水线编排器。创建和管理能力流水线，支持顺序执行。
 */
@Service
public class PipelineComposer {

    private static final Logger log = LoggerFactory.getLogger(PipelineComposer.class);

    private final PipelineRepository pipelineRepository;
    private final CapabilityRegistry capabilityRegistry;

    @Value("${capability.pipeline.max-steps:20}")
    private int maxSteps;

    public PipelineComposer(PipelineRepository pipelineRepository,
                            CapabilityRegistry capabilityRegistry) {
        this.pipelineRepository = pipelineRepository;
        this.capabilityRegistry = capabilityRegistry;
    }

    /**
     * 创建新流水线。
     */
    public Pipeline createPipeline(String name, String description, List<PipelineStep> steps) {
        if (steps != null && steps.size() > maxSteps) {
            throw new IllegalArgumentException(
                    "Pipeline exceeds max steps limit: " + maxSteps);
        }

        // 验证所有步骤引用的能力都存在
        if (steps != null) {
            for (PipelineStep step : steps) {
                if (!capabilityRegistry.contains(step.capabilityName())) {
                    throw new IllegalArgumentException(
                            "Capability not found: " + step.capabilityName());
                }
            }
        }

        Pipeline pipeline = Pipeline.create(name, description, steps);
        pipelineRepository.save(pipeline);
        log.info("Created pipeline '{}' with {} steps", name, steps != null ? steps.size() : 0);
        return pipeline;
    }

    /**
     * 执行流水线。按步骤顺序依次执行每个能力，将前一步的输出作为上下文传递给下一步。
     */
    public List<CapabilityResult> executePipeline(PipelineId pipelineId, CapabilityContext initialContext) {
        Pipeline pipeline = pipelineRepository.findById(pipelineId)
                .orElseThrow(() -> new IllegalArgumentException("Pipeline not found: " + pipelineId));

        return executePipeline(pipeline, initialContext);
    }

    /**
     * 执行流水线。
     */
    public List<CapabilityResult> executePipeline(Pipeline pipeline, CapabilityContext initialContext) {
        List<CapabilityResult> results = new ArrayList<>();
        List<PipelineStep> orderedSteps = pipeline.orderedSteps();

        log.info("Executing pipeline '{}' with {} steps", pipeline.name(), orderedSteps.size());

        for (PipelineStep step : orderedSteps) {
            Capability capability = capabilityRegistry.findByName(step.capabilityName())
                    .orElseThrow(() -> new IllegalStateException(
                            "Capability not found during execution: " + step.capabilityName()));

            log.debug("Executing step {}: {}", step.order(), step.capabilityName());

            CapabilityResult result = capability.execute(initialContext);
            results.add(result);

            if (!result.success()) {
                log.warn("Pipeline '{}' failed at step {}: {}", pipeline.name(),
                        step.order(), result.message());
                break; // 失败时停止执行
            }
        }

        return results;
    }

    /**
     * 获取流水线详情。
     */
    public Pipeline getPipeline(PipelineId pipelineId) {
        return pipelineRepository.findById(pipelineId)
                .orElseThrow(() -> new IllegalArgumentException("Pipeline not found: " + pipelineId));
    }

    /**
     * 获取所有流水线。
     */
    public List<Pipeline> findAll() {
        return pipelineRepository.findAll();
    }

    /**
     * 删除流水线。
     */
    public void deletePipeline(PipelineId pipelineId) {
        pipelineRepository.deleteById(pipelineId);
        log.info("Deleted pipeline {}", pipelineId);
    }
}
