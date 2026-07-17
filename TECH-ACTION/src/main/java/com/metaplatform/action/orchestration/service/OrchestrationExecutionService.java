package com.metaplatform.action.orchestration.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.core.type.TypeReference;
import com.metaplatform.action.common.ErrorCode;
import com.metaplatform.action.common.TenantContext;
import com.metaplatform.action.common.TraceContext;
import com.metaplatform.action.exception.ActionException;
import com.metaplatform.action.execution.dto.SyncExecutionRequest;
import com.metaplatform.action.execution.dto.SyncExecutionResponse;
import com.metaplatform.action.execution.service.HttpExecutionService;
import com.metaplatform.action.integration.rule.RuleIntegrationService;
import com.metaplatform.action.orchestration.dto.CompensationResponse;
import com.metaplatform.action.orchestration.dto.NodeStateDto;
import com.metaplatform.action.orchestration.dto.OrchestrationExecutionResponse;
import com.metaplatform.action.orchestration.dto.StartOrchestrationRequest;
import com.metaplatform.action.orchestration.entity.OrchestrationEntity;
import com.metaplatform.action.orchestration.entity.OrchestrationExecutionEntity;
import com.metaplatform.action.orchestration.repository.OrchestrationExecutionRepository;
import com.metaplatform.action.outbox.service.ActionEventType;
import com.metaplatform.action.outbox.service.ActionOutboxService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class OrchestrationExecutionService {

    public static final String STATUS_PENDING = "PENDING";
    public static final String STATUS_RUNNING = "RUNNING";
    public static final String STATUS_COMPLETED = "COMPLETED";
    public static final String STATUS_FAILED = "FAILED";
    public static final String STATUS_SKIPPED = "SKIPPED";

    public static final String COMP_NONE = "NONE";
    public static final String COMP_RUNNING = "RUNNING";
    public static final String COMP_COMPLETED = "COMPLETED";
    public static final String COMP_FAILED = "FAILED";
    public static final String COMP_SKIPPED = "SKIPPED";

    private static final TypeReference<List<NodeStateDto>> NODE_STATE_TYPE = new TypeReference<>() {};

    private final OrchestrationExecutionRepository executionRepository;
    private final OrchestrationService orchestrationService;
    private final HttpExecutionService httpExecutionService;
    private final ActionOutboxService actionOutboxService;
    private final RuleIntegrationService ruleIntegrationService;
    private final ObjectMapper objectMapper;

    public String startExecution(String orchestrationId, StartOrchestrationRequest request) {
        String tenantId = TenantContext.getOrDefault();
        OrchestrationEntity orchestration = orchestrationService.findByOrchestrationId(orchestrationId);
        if (!OrchestrationService.STATUS_PUBLISHED.equals(orchestration.getStatus())) {
            throw new ActionException(ErrorCode.ACTION_NOT_PUBLISHED, "编排未发布，不可执行");
        }

        String executionId = "orch-exec-" + UUID.randomUUID();
        String traceId = TraceContext.getOrCreate();
        Instant now = Instant.now();
        List<NodeStateDto> initialStates = initNodeStates(orchestration.getNodes());

        OrchestrationExecutionEntity execution = OrchestrationExecutionEntity.builder()
                .tenantId(tenantId)
                .executionId(executionId)
                .orchestrationId(orchestrationId)
                .status(STATUS_RUNNING)
                .nodeStates(writeJson(initialStates))
                .input(writeJson(request == null ? null : request.getInput()))
                .compensationActions("[]")
                .traceId(traceId)
                .startedAt(now)
                .createdAt(now)
                .updatedAt(now)
                .build();
        executionRepository.save(execution);

        actionOutboxService.publish(tenantId, executionId, ActionEventType.ORCHESTRATION_STARTED,
                Map.of("orchestrationId", orchestrationId, "executionId", executionId), traceId);

        return executionId;
    }

    @org.springframework.transaction.annotation.Transactional(readOnly = true)
    public OrchestrationExecutionResponse getExecution(String executionId) {
        String tenantId = TenantContext.getOrDefault();
        OrchestrationExecutionEntity execution = executionRepository
                .findByTenantIdAndExecutionId(tenantId, executionId)
                .orElseThrow(() -> new ActionException(ErrorCode.ORCHESTRATION_EXECUTION_NOT_FOUND,
                        "编排执行不存在"));
        return toResponse(execution);
    }

    public void processExecution(String executionId) {
        String tenantId = TenantContext.getOrDefault();
        OrchestrationExecutionEntity execution = executionRepository
                .findByTenantIdAndExecutionId(tenantId, executionId)
                .orElseThrow(() -> new ActionException(ErrorCode.ORCHESTRATION_EXECUTION_NOT_FOUND,
                        "编排执行不存在"));
        if (!STATUS_RUNNING.equals(execution.getStatus())) {
            log.warn("Execution {} is not RUNNING ({}), skip processing", executionId, execution.getStatus());
            return;
        }

        try {
            TraceContext.set(execution.getTraceId());
            OrchestrationEntity orchestration = orchestrationService.findByOrchestrationId(execution.getOrchestrationId());
            Map<String, NodeStateDto> states = toStateMap(execution.getNodeStates());
            JsonNode nodes = parseJson(orchestration.getNodes());
            JsonNode edges = parseJson(orchestration.getEdges());

            Map<String, JsonNode> nodeById = indexNodes(nodes);
            Set<String> targets = collectTargets(edges);
            List<String> entryNodes = new ArrayList<>();
            for (JsonNode node : nodes) {
                String id = node.get("id").asText();
                if (!targets.contains(id)) {
                    entryNodes.add(id);
                }
            }

            Map<String, List<String>> adjacency = buildAdjacency(edges);
            Set<String> visited = new HashSet<>();
            List<String> worklist = new ArrayList<>(entryNodes);
            List<String> completedOrder = new ArrayList<>();
            Object input = readValue(execution.getInput());

            while (!worklist.isEmpty()) {
                String nodeId = worklist.remove(0);
                if (visited.contains(nodeId)) {
                    continue;
                }
                visited.add(nodeId);
                JsonNode node = nodeById.get(nodeId);
                if (node == null) {
                    continue;
                }
                NodeStateDto state = states.computeIfAbsent(nodeId, k -> NodeStateDto.builder()
                        .nodeId(nodeId).status(STATUS_PENDING).compensationStatus(COMP_NONE).build());
                state.setActionCode(textField(node, "actionCode"));

                Instant started = Instant.now();
                state.setStatus(STATUS_RUNNING);
                state.setStartedAt(started);
                execution.setNodeStates(writeJson(new ArrayList<>(states.values())));
                executionRepository.save(execution);

                try {
                    SyncExecutionRequest syncRequest = new SyncExecutionRequest();
                    syncRequest.setActionCode(state.getActionCode());
                    syncRequest.setInput(input);
                    SyncExecutionResponse resp = httpExecutionService.executeSync(syncRequest);
                    state.setStatus(STATUS_COMPLETED);
                    state.setCompletedAt(Instant.now());
                    if (resp != null && resp.getOutput() != null) {
                        input = resp.getOutput();
                    }
                    completedOrder.add(nodeId);

                    List<String> successors = adjacency.getOrDefault(nodeId, List.of());
                    if (GraphValidator.NODE_CONDITIONAL.equals(textField(node, "type"))) {
                        String chosen = resolveConditionalTarget(nodeId, orchestration, input);
                        for (String s : successors) {
                            if (s.equals(chosen)) {
                                worklist.add(s);
                            } else {
                                markSkipped(states, s, nodeById, adjacency, visited);
                            }
                        }
                    } else {
                        worklist.addAll(successors);
                    }
                } catch (ActionException e) {
                    state.setStatus(STATUS_FAILED);
                    state.setCompletedAt(Instant.now());
                    state.setError(e.getMessage());
                    execution.setNodeStates(writeJson(new ArrayList<>(states.values())));
                    failExecution(execution, e.getMessage(), states, completedOrder, nodeById, orchestration);
                    return;
                }
                execution.setNodeStates(writeJson(new ArrayList<>(states.values())));
                executionRepository.save(execution);
            }

            for (NodeStateDto s : states.values()) {
                if (STATUS_PENDING.equals(s.getStatus())) {
                    s.setStatus(STATUS_SKIPPED);
                }
            }

            Instant completedAt = Instant.now();
            execution.setStatus(STATUS_COMPLETED);
            execution.setNodeStates(writeJson(new ArrayList<>(states.values())));
            execution.setOutput(writeJson(input));
            execution.setCompletedAt(completedAt);
            execution.setDurationMs(durationMs(execution.getStartedAt(), completedAt));
            execution.setUpdatedAt(completedAt);
            executionRepository.save(execution);

            actionOutboxService.publish(execution.getTenantId(), executionId,
                    ActionEventType.ORCHESTRATION_COMPLETED,
                    Map.of("orchestrationId", execution.getOrchestrationId(), "executionId", executionId),
                    execution.getTraceId());
        } catch (ActionException e) {
            failExecutionSafe(execution, e.getMessage());
        } catch (Exception e) {
            log.error("Unexpected error processing execution {}", executionId, e);
            failExecutionSafe(execution, e.getMessage());
        } finally {
            TraceContext.clear();
        }
    }

    public CompensationResponse compensate(String executionId) {
        String tenantId = TenantContext.getOrDefault();
        OrchestrationExecutionEntity execution = executionRepository
                .findByTenantIdAndExecutionId(tenantId, executionId)
                .orElseThrow(() -> new ActionException(ErrorCode.ORCHESTRATION_EXECUTION_NOT_FOUND,
                        "编排执行不存在"));
        OrchestrationEntity orchestration = orchestrationService.findByOrchestrationId(execution.getOrchestrationId());

        try {
            TraceContext.set(execution.getTraceId());
            Map<String, NodeStateDto> states = toStateMap(execution.getNodeStates());
            JsonNode nodes = parseJson(orchestration.getNodes());
            Map<String, JsonNode> nodeById = indexNodes(nodes);

            List<NodeStateDto> completed = new ArrayList<>();
            for (NodeStateDto s : states.values()) {
                if (STATUS_COMPLETED.equals(s.getStatus())) {
                    completed.add(s);
                }
            }
            java.util.Collections.reverse(completed);

            List<NodeStateDto> compensated = new ArrayList<>();
            for (NodeStateDto s : completed) {
                JsonNode node = nodeById.get(s.getNodeId());
                String compAction = node == null ? null : textField(node, "compensationActionCode");
                s.setCompensationStatus(COMP_RUNNING);
                execution.setNodeStates(writeJson(new ArrayList<>(states.values())));
                executionRepository.save(execution);
                if (compAction == null || compAction.isBlank()) {
                    s.setCompensationStatus(COMP_SKIPPED);
                    compensated.add(copy(s));
                    continue;
                }
                try {
                    SyncExecutionRequest req = new SyncExecutionRequest();
                    req.setActionCode(compAction);
                    req.setInput(readValue(execution.getInput()));
                    httpExecutionService.executeSync(req);
                    s.setCompensationStatus(COMP_COMPLETED);
                } catch (Exception e) {
                    log.error("Compensation failed for node {} in execution {}", s.getNodeId(), executionId, e);
                    s.setCompensationStatus(COMP_FAILED);
                    s.setError(e.getMessage());
                }
                compensated.add(copy(s));
                execution.setNodeStates(writeJson(new ArrayList<>(states.values())));
                executionRepository.save(execution);
            }

            execution.setCompensationActions(writeJson(compensated));
            execution.setUpdatedAt(Instant.now());
            executionRepository.save(execution);

            return CompensationResponse.builder()
                    .executionId(executionId)
                    .status("COMPLETED")
                    .compensatedNodes(compensated)
                    .build();
        } catch (Exception e) {
            throw new ActionException(ErrorCode.COMPENSATION_ERROR, "补偿事务执行失败: " + e.getMessage());
        } finally {
            TraceContext.clear();
        }
    }

    private void failExecution(OrchestrationExecutionEntity execution, String errorMessage,
                               Map<String, NodeStateDto> states, List<String> completedOrder,
                               Map<String, JsonNode> nodeById, OrchestrationEntity orchestration) {
        Instant failedAt = Instant.now();
        execution.setStatus(STATUS_FAILED);
        execution.setErrorMessage(errorMessage);
        execution.setCompletedAt(failedAt);
        execution.setDurationMs(durationMs(execution.getStartedAt(), failedAt));
        execution.setUpdatedAt(failedAt);
        executionRepository.save(execution);

        actionOutboxService.publish(execution.getTenantId(), execution.getExecutionId(),
                ActionEventType.ORCHESTRATION_FAILED,
                Map.of("orchestrationId", execution.getOrchestrationId(),
                        "executionId", execution.getExecutionId(),
                        "errorMessage", errorMessage),
                execution.getTraceId());

        runAutoCompensation(execution, states, completedOrder, nodeById);
    }

    private void failExecutionSafe(OrchestrationExecutionEntity execution, String errorMessage) {
        try {
            Instant failedAt = Instant.now();
            execution.setStatus(STATUS_FAILED);
            execution.setErrorMessage(errorMessage);
            execution.setCompletedAt(failedAt);
            execution.setDurationMs(durationMs(execution.getStartedAt(), failedAt));
            execution.setUpdatedAt(failedAt);
            executionRepository.save(execution);
            actionOutboxService.publish(execution.getTenantId(), execution.getExecutionId(),
                    ActionEventType.ORCHESTRATION_FAILED,
                    Map.of("orchestrationId", execution.getOrchestrationId(),
                            "executionId", execution.getExecutionId(), "errorMessage", errorMessage),
                    execution.getTraceId());
        } catch (Exception e) {
            log.error("Failed to mark execution {} as FAILED", execution.getExecutionId(), e);
        }
    }

    private void runAutoCompensation(OrchestrationExecutionEntity execution,
                                     Map<String, NodeStateDto> states, List<String> completedOrder,
                                     Map<String, JsonNode> nodeById) {
        List<NodeStateDto> compensated = new ArrayList<>();
        for (int i = completedOrder.size() - 1; i >= 0; i--) {
            String nodeId = completedOrder.get(i);
            NodeStateDto state = states.get(nodeId);
            JsonNode node = nodeById.get(nodeId);
            String compAction = node == null ? null : textField(node, "compensationActionCode");
            if (compAction == null || compAction.isBlank()) {
                state.setCompensationStatus(COMP_SKIPPED);
                compensated.add(copy(state));
                continue;
            }
            state.setCompensationStatus(COMP_RUNNING);
            try {
                SyncExecutionRequest req = new SyncExecutionRequest();
                req.setActionCode(compAction);
                httpExecutionService.executeSync(req);
                state.setCompensationStatus(COMP_COMPLETED);
            } catch (Exception e) {
                state.setCompensationStatus(COMP_FAILED);
                state.setError(e.getMessage());
            }
            compensated.add(copy(state));
        }
        execution.setNodeStates(writeJson(new ArrayList<>(states.values())));
        execution.setCompensationActions(writeJson(compensated));
        execution.setUpdatedAt(Instant.now());
        executionRepository.save(execution);
    }

    private String resolveConditionalTarget(String nodeId, OrchestrationEntity orchestration, Object input) {
        JsonNode ruleIntegration = parseJson(orchestration.getRuleIntegration());
        JsonNode nodeRule = ruleIntegration.get(nodeId);
        if (nodeRule == null || nodeRule.isNull()) {
            throw new ActionException(ErrorCode.RULE_EVALUATION_ERROR,
                    "条件节点缺少规则配置: " + nodeId);
        }
        String rulesetId = textField(nodeRule, "rulesetId");
        String resultKey = textField(nodeRule, "resultKey");
        if (rulesetId == null || rulesetId.isBlank()) {
            throw new ActionException(ErrorCode.RULE_EVALUATION_ERROR,
                    "条件节点缺少 rulesetId: " + nodeId);
        }
        JsonNode result = ruleIntegrationService.evaluateRuleset(rulesetId, input);
        return ruleIntegrationService.resolveTargetNodeId(result, resultKey);
    }

    private void markSkipped(Map<String, NodeStateDto> states, String nodeId,
                             Map<String, JsonNode> nodeById, Map<String, List<String>> adjacency,
                             Set<String> visited) {
        if (visited.contains(nodeId)) {
            return;
        }
        visited.add(nodeId);
        NodeStateDto state = states.computeIfAbsent(nodeId, k -> NodeStateDto.builder()
                .nodeId(nodeId).status(STATUS_SKIPPED).compensationStatus(COMP_NONE).build());
        state.setStatus(STATUS_SKIPPED);
        JsonNode node = nodeById.get(nodeId);
        if (node != null) {
            state.setActionCode(textField(node, "actionCode"));
        }
        for (String next : adjacency.getOrDefault(nodeId, List.of())) {
            markSkipped(states, next, nodeById, adjacency, visited);
        }
    }

    private List<NodeStateDto> initNodeStates(String nodesJson) {
        JsonNode nodes = parseJson(nodesJson);
        List<NodeStateDto> states = new ArrayList<>();
        for (JsonNode node : nodes) {
            states.add(NodeStateDto.builder()
                    .nodeId(node.get("id").asText())
                    .actionCode(textField(node, "actionCode"))
                    .status(STATUS_PENDING)
                    .compensationStatus(COMP_NONE)
                    .build());
        }
        return states;
    }

    private Map<String, NodeStateDto> toStateMap(String nodeStatesJson) {
        try {
            List<NodeStateDto> list = objectMapper.readValue(
                    nodeStatesJson == null || nodeStatesJson.isBlank() ? "[]" : nodeStatesJson, NODE_STATE_TYPE);
            Map<String, NodeStateDto> map = new LinkedHashMap<>();
            for (NodeStateDto s : list) {
                map.put(s.getNodeId(), s);
            }
            return map;
        } catch (Exception e) {
            throw new ActionException(ErrorCode.INTERNAL_ERROR, "node_states 解析失败");
        }
    }

    private Map<String, JsonNode> indexNodes(JsonNode nodes) {
        Map<String, JsonNode> map = new HashMap<>();
        for (JsonNode node : nodes) {
            map.put(node.get("id").asText(), node);
        }
        return map;
    }

    private Set<String> collectTargets(JsonNode edges) {
        Set<String> targets = new HashSet<>();
        for (JsonNode edge : edges) {
            targets.add(edge.get("target").asText());
        }
        return targets;
    }

    private Map<String, List<String>> buildAdjacency(JsonNode edges) {
        Map<String, List<String>> adjacency = new HashMap<>();
        for (JsonNode edge : edges) {
            String source = edge.get("source").asText();
            String target = edge.get("target").asText();
            adjacency.computeIfAbsent(source, k -> new ArrayList<>()).add(target);
        }
        return adjacency;
    }

    private NodeStateDto copy(NodeStateDto s) {
        return NodeStateDto.builder()
                .nodeId(s.getNodeId())
                .actionCode(s.getActionCode())
                .status(s.getStatus())
                .startedAt(s.getStartedAt())
                .completedAt(s.getCompletedAt())
                .error(s.getError())
                .compensationStatus(s.getCompensationStatus())
                .build();
    }

    private OrchestrationExecutionResponse toResponse(OrchestrationExecutionEntity execution) {
        List<NodeStateDto> nodeStates = toStateList(execution.getNodeStates());
        List<NodeStateDto> compensation = toStateList(execution.getCompensationActions());
        return OrchestrationExecutionResponse.builder()
                .executionId(execution.getExecutionId())
                .orchestrationId(execution.getOrchestrationId())
                .status(execution.getStatus())
                .nodeStates(nodeStates)
                .input(readValue(execution.getInput()))
                .output(readValue(execution.getOutput()))
                .errorMessage(execution.getErrorMessage())
                .traceId(execution.getTraceId())
                .startedAt(execution.getStartedAt())
                .completedAt(execution.getCompletedAt())
                .durationMs(execution.getDurationMs())
                .compensationActions(compensation)
                .build();
    }

    private List<NodeStateDto> toStateList(String json) {
        try {
            return objectMapper.readValue(json == null || json.isBlank() ? "[]" : json, NODE_STATE_TYPE);
        } catch (Exception e) {
            return List.of();
        }
    }

    private JsonNode parseJson(String json) {
        try {
            return objectMapper.readTree(json == null || json.isBlank() ? "[]" : json);
        } catch (Exception e) {
            throw new ActionException(ErrorCode.INVALID_PARAM, "JSON 解析失败");
        }
    }

    private String writeJson(Object value) {
        if (value == null) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception e) {
            throw new ActionException(ErrorCode.INTERNAL_ERROR, "JSON 序列化失败");
        }
    }

    private Object readValue(String json) {
        if (json == null || json.isBlank()) {
            return null;
        }
        try {
            return objectMapper.readValue(json, Object.class);
        } catch (Exception e) {
            return json;
        }
    }

    private String textField(JsonNode node, String field) {
        JsonNode value = node.get(field);
        return value == null || value.isNull() ? null : value.asText();
    }

    private Integer durationMs(Instant started, Instant end) {
        if (started == null || end == null) {
            return null;
        }
        return (int) (end.toEpochMilli() - started.toEpochMilli());
    }
}
