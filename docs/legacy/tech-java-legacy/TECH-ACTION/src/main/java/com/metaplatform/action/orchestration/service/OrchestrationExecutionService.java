package com.metaplatform.action.orchestration.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
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
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
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

    private static final String ITEMS_KEY = "items";

    private final OrchestrationExecutionRepository executionRepository;
    private final OrchestrationService orchestrationService;
    private final HttpExecutionService httpExecutionService;
    private final ActionOutboxService actionOutboxService;
    private final RuleIntegrationService ruleIntegrationService;
    private final ObjectMapper objectMapper;

    @Autowired
    @Lazy
    private OrchestrationAsyncRunner orchestrationAsyncRunner;

    public String startExecution(String orchestrationId, StartOrchestrationRequest request) {
        String tenantId = TenantContext.getOrDefault();
        OrchestrationEntity orchestration = orchestrationService.findByOrchestrationId(orchestrationId);
        if (!OrchestrationService.STATUS_PUBLISHED.equals(orchestration.getStatus())) {
            throw new ActionException(ErrorCode.ACTION_NOT_PUBLISHED, "编排未发布，不可执行");
        }

        String executionId = "orch-exec-" + UUID.randomUUID();
        String traceId = TraceContext.getOrCreate();
        Instant now = Instant.now();
        Map<String, Object> initialStates = wrapList(initNodeStates(orchestration.getNodes()));
        Map<String, Object> input = toMap(request == null ? null : request.getInput());

        OrchestrationExecutionEntity execution = OrchestrationExecutionEntity.builder()
                .tenantId(tenantId)
                .executionId(executionId)
                .orchestrationId(orchestrationId)
                .status(STATUS_RUNNING)
                .nodeStates(initialStates)
                .input(input)
                .compensationActions(wrapList(new ArrayList<>()))
                .traceId(traceId)
                .startedAt(now)
                .createdAt(now)
                .updatedAt(now)
                .build();
        executionRepository.save(execution);

        actionOutboxService.publish(tenantId, executionId, ActionEventType.ORCHESTRATION_STARTED,
                Map.of("orchestrationId", orchestrationId, "executionId", executionId), traceId);

        orchestrationAsyncRunner.run(executionId, tenantId, traceId);

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
            List<Map<String, Object>> nodes = nodesList(orchestration.getNodes());
            List<Map<String, Object>> edges = edgesList(orchestration.getEdges());

            Map<String, Map<String, Object>> nodeById = indexNodes(nodes);
            Set<String> targets = collectTargets(edges);
            List<String> entryNodes = new ArrayList<>();
            for (Map<String, Object> node : nodes) {
                String id = textField(node, "id");
                if (!targets.contains(id)) {
                    entryNodes.add(id);
                }
            }

            Map<String, List<String>> adjacency = buildAdjacency(edges);
            Set<String> visited = new HashSet<>();
            List<String> worklist = new ArrayList<>(entryNodes);
            List<String> completedOrder = new ArrayList<>();
            Object input = execution.getInput();

            while (!worklist.isEmpty()) {
                String nodeId = worklist.remove(0);
                if (visited.contains(nodeId)) {
                    continue;
                }
                visited.add(nodeId);
                Map<String, Object> node = nodeById.get(nodeId);
                if (node == null) {
                    continue;
                }
                NodeStateDto state = states.computeIfAbsent(nodeId, k -> {
                    NodeStateDto s = NodeStateDto.builder().build();
                    s.setNodeId(nodeId);
                    s.setStatus(STATUS_PENDING);
                    s.setCompensationStatus(COMP_NONE);
                    return s;
                });
                state.setActionCode(textField(node, "actionCode"));

                Instant started = Instant.now();
                state.setStatus(STATUS_RUNNING);
                state.setStartedAt(started);
                execution.setNodeStates(wrapList(stateList(states)));
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
                    execution.setNodeStates(wrapList(stateList(states)));
                    failExecution(execution, e.getMessage(), states, completedOrder, nodeById, orchestration);
                    return;
                }
                execution.setNodeStates(wrapList(stateList(states)));
                executionRepository.save(execution);
            }

            for (NodeStateDto s : states.values()) {
                if (STATUS_PENDING.equals(s.getStatus())) {
                    s.setStatus(STATUS_SKIPPED);
                }
            }

            Instant completedAt = Instant.now();
            execution.setStatus(STATUS_COMPLETED);
            execution.setNodeStates(wrapList(stateList(states)));
            execution.setOutput(toMap(input));
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
            List<Map<String, Object>> nodes = nodesList(orchestration.getNodes());
            Map<String, Map<String, Object>> nodeById = indexNodes(nodes);

            List<NodeStateDto> completed = new ArrayList<>();
            for (NodeStateDto s : states.values()) {
                if (STATUS_COMPLETED.equals(s.getStatus())) {
                    completed.add(s);
                }
            }
            Collections.reverse(completed);

            List<NodeStateDto> compensated = new ArrayList<>();
            for (NodeStateDto s : completed) {
                Map<String, Object> node = nodeById.get(s.getNodeId());
                String compAction = node == null ? null : textField(node, "compensationActionCode");
                s.setCompensationStatus(COMP_RUNNING);
                execution.setNodeStates(wrapList(stateList(states)));
                executionRepository.save(execution);
                if (compAction == null || compAction.isBlank()) {
                    s.setCompensationStatus(COMP_SKIPPED);
                    compensated.add(copy(s));
                    continue;
                }
                try {
                    SyncExecutionRequest req = new SyncExecutionRequest();
                    req.setActionCode(compAction);
                    req.setInput(execution.getInput());
                    httpExecutionService.executeSync(req);
                    s.setCompensationStatus(COMP_COMPLETED);
                } catch (Exception e) {
                    log.error("Compensation failed for node {} in execution {}", s.getNodeId(), executionId, e);
                    s.setCompensationStatus(COMP_FAILED);
                    s.setError(e.getMessage());
                }
                compensated.add(copy(s));
                execution.setNodeStates(wrapList(stateList(states)));
                executionRepository.save(execution);
            }

            execution.setCompensationActions(wrapList(toStateMapList(compensated)));
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
                               Map<String, Map<String, Object>> nodeById, OrchestrationEntity orchestration) {
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
                                     Map<String, Map<String, Object>> nodeById) {
        List<NodeStateDto> compensated = new ArrayList<>();
        for (int i = completedOrder.size() - 1; i >= 0; i--) {
            String nodeId = completedOrder.get(i);
            NodeStateDto state = states.get(nodeId);
            Map<String, Object> node = nodeById.get(nodeId);
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
        execution.setNodeStates(wrapList(stateList(states)));
        execution.setCompensationActions(wrapList(toStateMapList(compensated)));
        execution.setUpdatedAt(Instant.now());
        executionRepository.save(execution);
    }

    private String resolveConditionalTarget(String nodeId, OrchestrationEntity orchestration, Object input) {
        Map<String, Object> ruleIntegration = orchestration.getRuleIntegration();
        if (ruleIntegration == null) {
            ruleIntegration = new HashMap<>();
        }
        Object nodeRule = ruleIntegration.get(nodeId);
        if (nodeRule == null) {
            throw new ActionException(ErrorCode.RULE_EVALUATION_ERROR,
                    "条件节点缺少规则配置: " + nodeId);
        }
        if (!(nodeRule instanceof Map<?, ?>)) {
            throw new ActionException(ErrorCode.RULE_EVALUATION_ERROR,
                    "条件节点规则配置非法: " + nodeId);
        }
        Map<String, Object> ruleMap = (Map<String, Object>) nodeRule;
        String rulesetId = textField(ruleMap, "rulesetId");
        String resultKey = textField(ruleMap, "resultKey");
        if (rulesetId == null || rulesetId.isBlank()) {
            throw new ActionException(ErrorCode.RULE_EVALUATION_ERROR,
                    "条件节点缺少 rulesetId: " + nodeId);
        }
        JsonNode result = ruleIntegrationService.evaluateRuleset(rulesetId, input);
        return ruleIntegrationService.resolveTargetNodeId(result, resultKey);
    }

    private void markSkipped(Map<String, NodeStateDto> states, String nodeId,
                             Map<String, Map<String, Object>> nodeById, Map<String, List<String>> adjacency,
                             Set<String> visited) {
        if (visited.contains(nodeId)) {
            return;
        }
        visited.add(nodeId);
        NodeStateDto state = states.computeIfAbsent(nodeId, k -> {
            NodeStateDto s = NodeStateDto.builder().build();
            s.setNodeId(nodeId);
            s.setStatus(STATUS_SKIPPED);
            s.setCompensationStatus(COMP_NONE);
            return s;
        });
        state.setStatus(STATUS_SKIPPED);
        Map<String, Object> node = nodeById.get(nodeId);
        if (node != null) {
            state.setActionCode(textField(node, "actionCode"));
        }
        for (String next : adjacency.getOrDefault(nodeId, List.of())) {
            markSkipped(states, next, nodeById, adjacency, visited);
        }
    }

    private List<Map<String, Object>> initNodeStates(Map<String, Object> nodesContainer) {
        List<Map<String, Object>> states = new ArrayList<>();
        if (nodesContainer == null) {
            return states;
        }
        Object nodesObj = nodesContainer.get("nodes");
        if (!(nodesObj instanceof List<?> list)) {
            return states;
        }
        for (Object o : list) {
            if (o instanceof Map<?, ?> m) {
                Map<String, Object> node = (Map<String, Object>) m;
                Map<String, Object> state = new LinkedHashMap<>();
                state.put("nodeId", textField(node, "id"));
                state.put("actionCode", textField(node, "actionCode"));
                state.put("status", STATUS_PENDING);
                state.put("compensationStatus", COMP_NONE);
                states.add(state);
            }
        }
        return states;
    }

    private Map<String, NodeStateDto> toStateMap(Map<String, Object> nodeStates) {
        Map<String, NodeStateDto> map = new LinkedHashMap<>();
        if (nodeStates == null) {
            return map;
        }
        List<Map<String, Object>> list = unwrapList(nodeStates);
        for (Map<String, Object> s : list) {
            NodeStateDto dto = mapOfState(s);
            if (dto != null) {
                map.put(dto.getNodeId(), dto);
            }
        }
        return map;
    }

    private NodeStateDto mapOfState(Map<String, Object> s) {
        if (s == null) {
            return null;
        }
        NodeStateDto dto = NodeStateDto.builder().build();
        dto.setNodeId(textField(s, "nodeId"));
        dto.setActionCode(textField(s, "actionCode"));
        dto.setStatus(textField(s, "status"));
        dto.setStartedAt(toInstant(s.get("startedAt")));
        dto.setCompletedAt(toInstant(s.get("completedAt")));
        dto.setError(textField(s, "error"));
        dto.setCompensationStatus(textField(s, "compensationStatus"));
        return dto;
    }

    private List<Map<String, Object>> stateList(Map<String, NodeStateDto> states) {
        List<Map<String, Object>> list = new ArrayList<>();
        for (NodeStateDto dto : states.values()) {
            list.add(stateToMap(dto));
        }
        return list;
    }

    private Map<String, Object> stateToMap(NodeStateDto dto) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("nodeId", dto.getNodeId());
        m.put("actionCode", dto.getActionCode());
        m.put("status", dto.getStatus());
        m.put("startedAt", dto.getStartedAt());
        m.put("completedAt", dto.getCompletedAt());
        m.put("error", dto.getError());
        m.put("compensationStatus", dto.getCompensationStatus());
        return m;
    }

    private List<Map<String, Object>> toStateMapList(List<NodeStateDto> states) {
        List<Map<String, Object>> list = new ArrayList<>();
        for (NodeStateDto dto : states) {
            list.add(stateToMap(dto));
        }
        return list;
    }

    private Map<String, Map<String, Object>> indexNodes(List<Map<String, Object>> nodes) {
        Map<String, Map<String, Object>> map = new HashMap<>();
        for (Map<String, Object> node : nodes) {
            map.put(textField(node, "id"), node);
        }
        return map;
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> nodesList(Map<String, Object> container) {
        if (container == null) {
            return List.of();
        }
        Object nodes = container.get("nodes");
        if (nodes instanceof List<?> list) {
            List<Map<String, Object>> result = new ArrayList<>();
            for (Object o : list) {
                if (o instanceof Map<?, ?>) {
                    result.add((Map<String, Object>) o);
                }
            }
            return result;
        }
        return List.of();
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> edgesList(Map<String, Object> container) {
        if (container == null) {
            return List.of();
        }
        Object edges = container.get("edges");
        if (edges instanceof List<?> list) {
            List<Map<String, Object>> result = new ArrayList<>();
            for (Object o : list) {
                if (o instanceof Map<?, ?>) {
                    result.add((Map<String, Object>) o);
                }
            }
            return result;
        }
        return List.of();
    }

    private Set<String> collectTargets(List<Map<String, Object>> edges) {
        Set<String> targets = new HashSet<>();
        for (Map<String, Object> edge : edges) {
            String target = textField(edge, "target");
            if (target != null) {
                targets.add(target);
            }
        }
        return targets;
    }

    private Map<String, List<String>> buildAdjacency(List<Map<String, Object>> edges) {
        Map<String, List<String>> adjacency = new HashMap<>();
        for (Map<String, Object> edge : edges) {
            String source = textField(edge, "source");
            String target = textField(edge, "target");
            if (source != null && target != null) {
                adjacency.computeIfAbsent(source, k -> new ArrayList<>()).add(target);
            }
        }
        return adjacency;
    }

    private NodeStateDto copy(NodeStateDto s) {
        NodeStateDto copy = NodeStateDto.builder().build();
        copy.setNodeId(s.getNodeId());
        copy.setActionCode(s.getActionCode());
        copy.setStatus(s.getStatus());
        copy.setStartedAt(s.getStartedAt());
        copy.setCompletedAt(s.getCompletedAt());
        copy.setError(s.getError());
        copy.setCompensationStatus(s.getCompensationStatus());
        return copy;
    }

    private OrchestrationExecutionResponse toResponse(OrchestrationExecutionEntity execution) {
        List<NodeStateDto> nodeStates = statesList(execution.getNodeStates());
        List<NodeStateDto> compensation = statesList(execution.getCompensationActions());
        return OrchestrationExecutionResponse.builder()
                .executionId(execution.getExecutionId())
                .orchestrationId(execution.getOrchestrationId())
                .status(execution.getStatus())
                .nodeStates(nodeStates)
                .input(execution.getInput())
                .output(execution.getOutput())
                .errorMessage(execution.getErrorMessage())
                .traceId(execution.getTraceId())
                .startedAt(execution.getStartedAt())
                .completedAt(execution.getCompletedAt())
                .durationMs(execution.getDurationMs())
                .compensationActions(compensation)
                .build();
    }

    private List<NodeStateDto> statesList(Map<String, Object> container) {
        List<NodeStateDto> result = new ArrayList<>();
        if (container == null) {
            return result;
        }
        List<Map<String, Object>> list = unwrapList(container);
        for (Map<String, Object> s : list) {
            NodeStateDto dto = mapOfState(s);
            if (dto != null) {
                result.add(dto);
            }
        }
        return result;
    }

    private Map<String, Object> wrapList(List<Map<String, Object>> list) {
        Map<String, Object> wrapper = new LinkedHashMap<>();
        wrapper.put(ITEMS_KEY, list == null ? new ArrayList<>() : list);
        return wrapper;
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> unwrapList(Map<String, Object> wrapper) {
        if (wrapper == null) {
            return List.of();
        }
        Object items = wrapper.get(ITEMS_KEY);
        if (items instanceof List<?> list) {
            List<Map<String, Object>> result = new ArrayList<>();
            for (Object o : list) {
                if (o instanceof Map<?, ?>) {
                    result.add((Map<String, Object>) o);
                }
            }
            return result;
        }
        return List.of();
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> toMap(Object input) {
        if (input == null) {
            return null;
        }
        if (input instanceof Map<?, ?> map) {
            return (Map<String, Object>) map;
        }
        try {
            return objectMapper.readValue(objectMapper.writeValueAsString(input), Map.class);
        } catch (Exception e) {
            return null;
        }
    }

    private Instant toInstant(Object o) {
        if (o == null) {
            return null;
        }
        if (o instanceof Instant inst) {
            return inst;
        }
        if (o instanceof Number n) {
            return Instant.ofEpochMilli(n.longValue());
        }
        if (o instanceof String s) {
            try {
                return Instant.parse(s);
            } catch (Exception e) {
                return null;
            }
        }
        return null;
    }

    private String textField(Map<String, Object> node, String field) {
        Object value = node == null ? null : node.get(field);
        return value == null ? null : value.toString();
    }

    private Integer durationMs(Instant started, Instant end) {
        if (started == null || end == null) {
            return null;
        }
        return (int) (end.toEpochMilli() - started.toEpochMilli());
    }
}