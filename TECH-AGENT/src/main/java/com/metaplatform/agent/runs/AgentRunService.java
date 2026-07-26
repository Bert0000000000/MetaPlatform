package com.metaplatform.agent.runs;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.agent.api.Phase1Exception;
import com.metaplatform.agent.common.TenantContext;
import com.metaplatform.agent.events.RunEventService;
import com.metaplatform.agent.runs.dto.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;

@Service
@RequiredArgsConstructor
public class AgentRunService {
    private final AgentRunRepository repository;
    private final ObjectMapper objectMapper;
    private final RunEventService runEventService;

    @Transactional
    public AgentRunDto create(CreateAgentRunRequest request) {
        String runtime = request.getRuntimeType() == null ? "DEERFLOW" : request.getRuntimeType();
        if (!Set.of("DEERFLOW", "FAST_QUERY").contains(runtime)) {
            throw Phase1Exception.badRequest("RUNTIME_TYPE_NOT_SUPPORTED", "Phase 1 only supports DEERFLOW and FAST_QUERY");
        }
        Instant now = Instant.now();
        AgentRunEntity entity = AgentRunEntity.builder()
                .runId(id("RUN-"))
                .tenantId(TenantContext.getTenantIdOrDefault())
                .userId(Optional.ofNullable(TenantContext.getUserId()).orElse("anonymous"))
                .agentId(request.getAgentId()).runtimeType(runtime)
                .contextEnvelopeId(request.getEnvelopeId()).status("PENDING")
                .goal(request.getGoal()).parentRunId(request.getParentRunId())
                .budget(json(request.getBudget() == null ? BudgetDto.builder().build() : request.getBudget()))
                .traceId(TenantContext.getTraceIdOrGenerate()).createdAt(now).updatedAt(now).build();
        AgentRunEntity saved = repository.saveAndFlush(entity);
        // AR-1/RE-2: the run row is flushed before its lifecycle event is persisted.
        runEventService.record(saved, "RUN_STARTED", Map.of(
                "agentId", saved.getAgentId(), "goal", saved.getGoal(), "runtimeType", saved.getRuntimeType()));
        return toDto(saved);
    }

    @Transactional(readOnly = true)
    public List<AgentRunDto> list(String tenantId, String status, int limit) {
        int bounded = Math.max(1, Math.min(limit <= 0 ? 50 : limit, 200));
        return repository.findAll().stream()
                .filter(r -> Objects.equals(r.getTenantId(), tenantId))
                .filter(r -> status == null || Objects.equals(r.getStatus(), status))
                .sorted(Comparator.comparing(AgentRunEntity::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .limit(bounded).map(this::toDto).toList();
    }

    @Transactional(readOnly = true)
    public AgentRunEntity require(String runId) {
        return repository.findById(runId).orElseThrow(() ->
                Phase1Exception.notFound("RUN_NOT_FOUND", "AgentRun not found: " + runId));
    }

    @Transactional(readOnly = true)
    public AgentRunDto get(String runId) { return toDto(require(runId)); }

    @Transactional
    public AgentRunDto cancel(String runId) {
        AgentRunEntity run = require(runId);
        if (Set.of("COMPLETED", "FAILED", "CANCELED", "DEGRADED").contains(run.getStatus())) {
            throw Phase1Exception.conflict("RUN_STATE_CONFLICT", "Run cannot be canceled from status " + run.getStatus());
        }
        run.setStatus("CANCELED");
        run.setFinishedAt(Instant.now());
        run.setUpdatedAt(Instant.now());
        run.setErrorCode(null);
        AgentRunEntity saved = repository.save(run);
        runEventService.record(saved, "RUN_FAILED", Map.of("errorCode", "RUN_CANCELED", "errorMessage", "Canceled by user"));
        return toDto(saved);
    }

    public AgentRunDto toDto(AgentRunEntity e) {
        return AgentRunDto.builder().runId(e.getRunId()).tenantId(e.getTenantId()).userId(e.getUserId())
                .agentId(e.getAgentId()).runtimeType(e.getRuntimeType()).contextEnvelopeId(e.getContextEnvelopeId())
                .status(e.getStatus()).goal(e.getGoal()).budget(parseBudget(e.getBudget())).parentRunId(e.getParentRunId())
                .traceId(e.getTraceId()).deerflowThreadId(e.getDeerflowThreadId()).deerflowRunId(e.getDeerflowRunId())
                .startedAt(e.getStartedAt()).finishedAt(e.getFinishedAt()).errorCode(e.getErrorCode())
                .errorMessage(e.getErrorMessage()).createdAt(e.getCreatedAt()).updatedAt(e.getUpdatedAt()).build();
    }

    private String json(Object value) {
        try { return objectMapper.writeValueAsString(value); }
        catch (JsonProcessingException ex) { throw new IllegalStateException("Unable to serialize budget", ex); }
    }
    private BudgetDto parseBudget(String value) {
        if (value == null || value.isBlank()) return BudgetDto.builder().build();
        try { return objectMapper.readValue(value, BudgetDto.class); }
        catch (Exception ex) { return BudgetDto.builder().build(); }
    }
    private static String id(String prefix) { return prefix + UUID.randomUUID().toString().replace("-", ""); }
}
