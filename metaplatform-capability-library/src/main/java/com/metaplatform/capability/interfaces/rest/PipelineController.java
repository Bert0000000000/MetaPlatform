package com.metaplatform.capability.interfaces.rest;

import com.metaplatform.capability.application.PipelineComposer;
import com.metaplatform.capability.domain.*;
import com.metaplatform.capability.interfaces.rest.dto.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * 流水线 REST 控制器。提供流水线管理的 API。
 */
@RestController
@RequestMapping("/api/v1/pipelines")
public class PipelineController {

    private static final Logger log = LoggerFactory.getLogger(PipelineController.class);

    private final PipelineComposer pipelineComposer;

    public PipelineController(PipelineComposer pipelineComposer) {
        this.pipelineComposer = pipelineComposer;
    }

    /**
     * POST /api/v1/pipelines - 创建流水线
     */
    @PostMapping
    public ResponseEntity<PipelineResponse> createPipeline(
            @RequestBody CreatePipelineRequest request) {
        try {
            List<PipelineStep> steps = request.steps() != null
                    ? request.steps().stream()
                    .map(s -> new PipelineStep(s.capabilityName(), s.order(), s.description()))
                    .toList()
                    : List.of();

            Pipeline pipeline = pipelineComposer.createPipeline(
                    request.name(), request.description(), steps);
            log.info("Created pipeline: {}", pipeline.name());
            return ResponseEntity.status(HttpStatus.CREATED)
                    .body(PipelineResponse.from(pipeline));
        } catch (IllegalArgumentException e) {
            log.warn("Create pipeline failed: {}", e.getMessage());
            return ResponseEntity.badRequest().build();
        }
    }

    /**
     * GET /api/v1/pipelines - 获取所有流水线
     */
    @GetMapping
    public ResponseEntity<List<PipelineResponse>> listPipelines() {
        List<Pipeline> pipelines = pipelineComposer.findAll();
        return ResponseEntity.ok(pipelines.stream()
                .map(PipelineResponse::from)
                .toList());
    }

    /**
     * GET /api/v1/pipelines/{id} - 获取流水线详情
     */
    @GetMapping("/{id}")
    public ResponseEntity<PipelineResponse> getPipeline(@PathVariable String id) {
        try {
            Pipeline pipeline = pipelineComposer.getPipeline(PipelineId.of(id));
            return ResponseEntity.ok(PipelineResponse.from(pipeline));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        }
    }

    /**
     * POST /api/v1/pipelines/{id}/execute - 执行流水线
     */
    @PostMapping("/{id}/execute")
    public ResponseEntity<List<ExecuteCapabilityResponse>> executePipeline(
            @PathVariable String id,
            @RequestBody(required = false) Map<String, Object> parameters) {
        try {
            CapabilityContext context = parameters != null
                    ? CapabilityContext.of(parameters)
                    : CapabilityContext.empty();
            List<CapabilityResult> results = pipelineComposer.executePipeline(
                    PipelineId.of(id), context);
            return ResponseEntity.ok(results.stream()
                    .map(ExecuteCapabilityResponse::from)
                    .toList());
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        }
    }

    /**
     * DELETE /api/v1/pipelines/{id} - 删除流水线
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deletePipeline(@PathVariable String id) {
        try {
            pipelineComposer.deletePipeline(PipelineId.of(id));
            return ResponseEntity.noContent().build();
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        }
    }
}
