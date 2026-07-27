package com.metaplatform.agent.runs;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.agent.api.Phase1Exception;
import com.metaplatform.agent.authoring.AuthoringService;
import com.metaplatform.ont.draft.OntologyDraftService;
import com.metaplatform.agent.common.TenantContext;
import com.metaplatform.agent.events.RunEventService;
import com.metaplatform.agent.runs.dto.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class AgentRunService {
    private final AgentRunRepository repository;
    private final ObjectMapper objectMapper;
    private final RunEventService runEventService;
    private final AuthoringService authoringService;
    private final TokenBudgetEnforcer tokenBudgetEnforcer;

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

    @Transactional
    public AgentRunDto bindDeerFlow(String runId, String threadId, String deerFlowRunId) {
        if (deerFlowRunId == null || deerFlowRunId.isBlank()) {
            throw new IllegalArgumentException("deerFlowRunId must not be blank");
        }
        AgentRunEntity run = require(runId);
        run.setDeerflowThreadId(threadId);
        run.setDeerflowRunId(deerFlowRunId);
        run.setStatus("RUNNING");
        run.setStartedAt(Instant.now());
        run.setUpdatedAt(Instant.now());
        return toDto(repository.saveAndFlush(run));
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

    /**
     * P6.4 Complete a run with status + answer. Triggers:
     *  1. RUN_COMPLETED (or RUN_FAILED) event recording
     *  2. AuthoringService hook: if answer contains KB extraction candidates, persists as Ontology Draft.
     */
    /**
     * P-NLB-01 server-enforced overload: requires explicit tokens + elapsedMs counters and
     * consults {@link TokenBudgetEnforcer}. If the budget is exceeded, the run is forced
     * to {@code DEGRADED} with errorCode BUDGET_EXCEEDED.
     */
    @Transactional
    public AgentRunDto complete(String runId, String status, String answer,
                                String errorCode, String errorMessage,
                                int tokensConsumed, long elapsedMs) {
        AgentRunEntity run = require(runId);
        com.metaplatform.agent.runs.dto.BudgetDto budget;
        try { budget = parseBudget(run.getBudget()); } catch (Exception e) { budget = null; }
        TokenBudgetEnforcer.EnforcementResult er = tokenBudgetEnforcer.check(budget, tokensConsumed, elapsedMs);
        if (!er.isAllowed()) {
            log.warn("[AgentRunService] budget exceeded run={} violation={} overBy={}; forcing DEGRADED",
                    runId, er.getViolation(), er.getOverBy());
            return complete(runId, "DEGRADED", answer,
                    "BUDGET_EXCEEDED",
                    er.getViolation() + " over by " + er.getOverBy());
        }
        return complete(runId, status, answer, errorCode, errorMessage);
    }

    @Transactional
    public AgentRunDto complete(String runId, String status, String answer, String errorCode, String errorMessage) {
        if (!Set.of("COMPLETED", "FAILED", "DEGRADED").contains(status)) {
            throw Phase1Exception.badRequest("INVALID_RUN_STATUS", "Unsupported completion status: " + status);
        }
        AgentRunEntity run = require(runId);
        run.setStatus(status);
        run.setFinishedAt(Instant.now());
        run.setUpdatedAt(Instant.now());
        if (errorCode != null) run.setErrorCode(errorCode);
        if (errorMessage != null) run.setErrorMessage(errorMessage);
        AgentRunEntity saved = repository.save(run);

        Map<String, Object> payload = new HashMap<>();
        if (answer != null) payload.put("answer", answer);
        if (errorCode != null) payload.put("errorCode", errorCode);
        if (errorMessage != null) payload.put("errorMessage", errorMessage);
        runEventService.record(saved, "RUN_" + status, payload);

        // P6.4 AuthoringService hook: auto-propose draft if answer carries candidate facts
        triggerAuthoringIfNeeded(saved, answer);

        return toDto(saved);
    }

    private void triggerAuthoringIfNeeded(AgentRunEntity run, String answer) {
        if (authoringService == null || answer == null || answer.isBlank()) return;
        // Conservative auto-route: only propose a draft when answer mentions a known extraction marker
        if (!answer.contains("@candidates") && !answer.contains("@kb-extract")) return;
        try {
            java.util.Map<String, Object> extraction = new java.util.HashMap<>();
            extraction.put("candidates", java.util.List.of());
            var req = authoringService.buildFromExtraction(
                    run.getTenantId(), run.getRunId(), "v1", "v2",
                    "Auto-draft from run " + run.getRunId(), extraction);
            authoringService.submit(req);
            log.info("[AgentRunService] auto-proposed draft for run={}", run.getRunId());
        } catch (Exception e) {
            log.warn("[AgentRunService] auto-propose draft failed for run={}: {}", run.getRunId(), e.getMessage());
        }
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
