package com.metaplatform.wfe.engine;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.wfe.common.ErrorCode;
import com.metaplatform.wfe.engine.converter.BpmnToFlowGramConverter;
import com.metaplatform.wfe.engine.executor.DefaultNodeExecutor;
import com.metaplatform.wfe.engine.executor.ExecutionContext;
import com.metaplatform.wfe.engine.executor.NodeExecutor;
import com.metaplatform.wfe.engine.model.FlowDocument;
import com.metaplatform.wfe.engine.model.FlowNode;
import com.metaplatform.wfe.engine.model.NodeExecutionResult;
import com.metaplatform.wfe.engine.parser.FlowGramParser;
import com.metaplatform.wfe.engine.variable.VariableEngine;
import com.metaplatform.wfe.entity.*;
import com.metaplatform.wfe.exception.WfeException;
import com.metaplatform.wfe.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;

/**
 * 自研状态机引擎核心。
 * 基于 FlowGram.AI fixed-layout JSON 驱动流程实例的执行、审批推进与终止。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class WfeStateMachineEngine {

    private static final String FLOWGRAM_JSON_VAR_KEY = "__flowgram_json__";
    private static final int MAX_NODE_ITERATIONS = 1000;

    private final FlowGramParser flowGramParser;
    private final VariableEngine variableEngine;
    private final List<NodeExecutor> executors;
    private final DefaultNodeExecutor defaultNodeExecutor;
    private final WfeTaskRepository taskRepository;
    private final WfeTaskHistoryRepository taskHistoryRepository;
    private final WfeActivityLogRepository activityLogRepository;
    private final WfeProcessVariableRepository variableRepository;
    private final WfeTaskCommentRepository taskCommentRepository;
    private final ProcessInstanceRepository processInstanceRepository;
    private final ProcessDefinitionRepository processDefinitionRepository;
    private final BpmnToFlowGramConverter bpmnToFlowGramConverter;
    private final ObjectMapper objectMapper;

    // ════════════════════════════════════════════
    // 启动流程实例
    // ════════════════════════════════════════════

    @Transactional
    public String startProcess(String tenantId, String processInstanceId, Map<String, Object> flowgramJson,
                               String startUserId, Map<String, Object> variables) {
        log.info("Starting process: tenantId={}, processInstanceId={}, startUserId={}",
                tenantId, processInstanceId, startUserId);

        String flowgramJsonStr = null;
        if (flowgramJson != null) {
            try {
                flowgramJsonStr = objectMapper.writeValueAsString(flowgramJson);
            } catch (Exception e) {
                throw new WfeException(ErrorCode.PROCESS_EXECUTION_FAILED,
                        "FlowGram JSON 序列化失败: " + e.getMessage());
            }
        }
        FlowDocument doc = flowGramParser.parse(flowgramJsonStr);
        flowGramParser.validate(doc);

        saveFlowgramJson(tenantId, processInstanceId, flowgramJsonStr);
        if (variables != null) {
            for (Map.Entry<String, Object> entry : variables.entrySet()) {
                saveVariable(tenantId, processInstanceId, entry.getKey(), entry.getValue());
            }
        }

        String processDefinitionId = processInstanceRepository
                .findByIdAndTenantId(processInstanceId, tenantId)
                .map(ProcessInstanceEntity::getProcessDefinitionId)
                .orElse(null);

        logActivity(tenantId, processInstanceId, null, null, "PROCESS_STARTED", startUserId);

        FlowNode startNode = flowGramParser.findStartNode(doc);
        if (startNode == null) {
            throw new WfeException(ErrorCode.BPMN_PARSE_FAILED, "未找到 start 节点");
        }

        Map<String, Object> execVariables = loadVariables(tenantId, processInstanceId);
        ExecutionContext context = new ExecutionContext(
                processInstanceId, tenantId, startUserId, processDefinitionId,
                execVariables, startNode.id(), doc);

        return executeNodeChain(doc, startNode.id(), context);
    }

    // ════════════════════════════════════════════
    // 完成任务，推进流程
    // ════════════════════════════════════════════

    @Transactional
    public void completeTask(String taskId, String action, String operator,
                             String comment, Map<String, Object> formData) {
        log.info("Completing task: taskId={}, action={}, operator={}", taskId, action, operator);

        WfeTaskEntity task = taskRepository.findById(taskId)
                .orElseThrow(() -> new WfeException(ErrorCode.TASK_NOT_FOUND));

        if (!"ACTIVE".equals(task.getStatus())) {
            throw new WfeException(ErrorCode.STATE_CONFLICT,
                    "任务状态不兼容，当前状态: " + task.getStatus());
        }

        String tenantId = task.getTenantId();
        String processInstanceId = task.getProcessInstanceId();

        String newStatus = "REJECT".equals(action) ? "REJECTED" : "COMPLETED";
        task.setStatus(newStatus);
        task.setAction(action);
        task.setCompletedAt(Instant.now());
        if (formData != null && !formData.isEmpty()) {
            task.setFormData(formData);
        }
        taskRepository.save(task);

        WfeTaskHistoryEntity history = WfeTaskHistoryEntity.builder()
                .id(UUID.randomUUID().toString())
                .tenantId(tenantId)
                .taskId(taskId)
                .processInstanceId(processInstanceId)
                .nodeId(task.getNodeId())
                .action(action)
                .operator(operator)
                .comment(comment)
                .formData(formData != null ? formData : null)
                .build();
        taskHistoryRepository.save(history);

        if (comment != null && !comment.isBlank()) {
            WfeTaskCommentEntity taskComment = WfeTaskCommentEntity.builder()
                    .id(UUID.randomUUID().toString())
                    .tenantId(tenantId)
                    .taskId(taskId)
                    .processInstanceId(processInstanceId)
                    .userId(operator)
                    .content(comment)
                    .build();
            taskCommentRepository.save(taskComment);
        }

        if ("REJECT".equals(action)) {
            terminateProcessInternal(tenantId, processInstanceId, "REJECTED by " + operator);
            return;
        }

        ProcessInstanceEntity instance = processInstanceRepository
                .findByIdAndTenantId(processInstanceId, tenantId)
                .orElseThrow(() -> new WfeException(ErrorCode.PROCESS_INSTANCE_NOT_FOUND));

        String flowgramJson = loadFlowgramJson(tenantId, processInstanceId,
                instance.getProcessDefinitionId());
        FlowDocument doc = flowGramParser.parse(flowgramJson);

        FlowNode nextNode = flowGramParser.findNextSibling(doc, task.getNodeId());
        if (nextNode == null) {
            instance.setStatus(ProcessInstanceStatus.COMPLETED);
            instance.setCompletedAt(Instant.now());
            processInstanceRepository.save(instance);
            logActivity(tenantId, processInstanceId, null, null, "PROCESS_COMPLETED", null);
            log.info("Process completed (no more nodes): processInstanceId={}", processInstanceId);
            return;
        }

        Map<String, Object> variables = loadVariables(tenantId, processInstanceId);
        if (formData != null) {
            variables.putAll(formData);
        }

        ExecutionContext context = new ExecutionContext(
                processInstanceId, tenantId, instance.getStartUserId(),
                instance.getProcessDefinitionId(),
                variables, nextNode.id(), doc);

        executeNodeChain(doc, nextNode.id(), context);
    }

    // ════════════════════════════════════════════
    // 终止流程实例
    // ════════════════════════════════════════════

    @Transactional
    public void terminateProcess(String processInstanceId, String reason) {
        ProcessInstanceEntity instance = processInstanceRepository.findById(processInstanceId)
                .orElseThrow(() -> new WfeException(ErrorCode.PROCESS_INSTANCE_NOT_FOUND));
        terminateProcessInternal(instance.getTenantId(), processInstanceId, reason);
    }

    private void terminateProcessInternal(String tenantId, String processInstanceId, String reason) {
        List<WfeTaskEntity> allTasks = taskRepository
                .findByTenantIdAndProcessInstanceIdOrderByCreatedAtDesc(tenantId, processInstanceId);
        List<WfeTaskEntity> activeTasks = allTasks.stream()
                .filter(t -> "ACTIVE".equals(t.getStatus()))
                .toList();
        for (WfeTaskEntity task : activeTasks) {
            task.setStatus("TERMINATED");
            task.setCompletedAt(Instant.now());
            taskRepository.save(task);
        }

        processInstanceRepository.findByIdAndTenantId(processInstanceId, tenantId)
                .ifPresent(instance -> {
                    instance.setStatus(ProcessInstanceStatus.TERMINATED);
                    instance.setCompletedAt(Instant.now());
                    processInstanceRepository.save(instance);
                });

        logActivity(tenantId, processInstanceId, null, null, "PROCESS_TERMINATED", reason);
        log.info("Process terminated: processInstanceId={}, reason={}, activeTasksTerminated={}",
                processInstanceId, reason, activeTasks.size());
    }

    // ════════════════════════════════════════════
    // 内部：执行节点链
    // ════════════════════════════════════════════

    private String executeNodeChain(FlowDocument doc, String startNodeId, ExecutionContext context) {
        String currentNodeId = startNodeId;

        for (int i = 0; i < MAX_NODE_ITERATIONS; i++) {
            FlowNode node = flowGramParser.findNodeById(doc, currentNodeId);
            if (node == null) {
                throw new WfeException(ErrorCode.PROCESS_EXECUTION_FAILED,
                        "节点不存在: " + currentNodeId);
            }

            NodeExecutor executor = getExecutor(node.type());
            ExecutionContext nodeContext = context.withCurrentNodeId(currentNodeId);
            NodeExecutionResult result = executor.execute(node, nodeContext);

            if (result.errorMessage() != null) {
                throw new WfeException(ErrorCode.PROCESS_EXECUTION_FAILED, result.errorMessage());
            }

            if (result.processCompleted()) {
                processInstanceRepository.findByIdAndTenantId(
                        context.processInstanceId(), context.tenantId())
                        .ifPresent(instance -> {
                            instance.setStatus(ProcessInstanceStatus.COMPLETED);
                            instance.setCompletedAt(Instant.now());
                            processInstanceRepository.save(instance);
                        });
                logActivity(context.tenantId(), context.processInstanceId(),
                        null, null, "PROCESS_COMPLETED", null);
                log.info("Process completed: processInstanceId={}", context.processInstanceId());
                return null;
            }

            if (!result.shouldContinue()) {
                log.info("Node chain paused at approval: processInstanceId={}, taskId={}",
                        context.processInstanceId(), result.createdTaskId());
                return result.createdTaskId();
            }

            if (result.nextNodeId() == null) {
                throw new WfeException(ErrorCode.PROCESS_EXECUTION_FAILED,
                        "节点 " + currentNodeId + " 未指定下一节点");
            }
            currentNodeId = result.nextNodeId();
        }

        throw new WfeException(ErrorCode.PROCESS_EXECUTION_FAILED,
                "节点链执行超过最大迭代次数: " + MAX_NODE_ITERATIONS);
    }

    // ════════════════════════════════════════════
    // 内部：获取节点执行器
    // ════════════════════════════════════════════

    private NodeExecutor getExecutor(String nodeType) {
        return executors.stream()
                .filter(e -> e.supportedType().equals(nodeType))
                .findFirst()
                .orElse(defaultNodeExecutor);
    }

    // ════════════════════════════════════════════
    // 内部：记录活动日志
    // ════════════════════════════════════════════

    private void logActivity(String tenantId, String processInstanceId, String nodeId,
                             String nodeType, String activityType, String assignee) {
        WfeActivityLogEntity entity = WfeActivityLogEntity.builder()
                .id(UUID.randomUUID().toString())
                .tenantId(tenantId)
                .processInstanceId(processInstanceId)
                .nodeId(nodeId != null ? nodeId : "N/A")
                .nodeType(nodeType != null ? nodeType : "PROCESS")
                .activityType(activityType)
                .assignee(assignee)
                .enteredAt(Instant.now())
                .build();
        activityLogRepository.save(entity);
    }

    // ════════════════════════════════════════════
    // 内部：变量持久化
    // ════════════════════════════════════════════

    private void saveVariable(String tenantId, String processInstanceId, String key, Object value) {
        String strValue = value instanceof String s ? s : String.valueOf(value);
        WfeProcessVariableEntity entity = WfeProcessVariableEntity.builder()
                .id(UUID.randomUUID().toString())
                .tenantId(tenantId)
                .processInstanceId(processInstanceId)
                .name(key)
                .value(strValue)
                .build();
        variableRepository.save(entity);
    }

    private Map<String, Object> loadVariables(String tenantId, String processInstanceId) {
        List<WfeProcessVariableEntity> entities = variableRepository
                .findByTenantIdAndProcessInstanceId(tenantId, processInstanceId);
        Map<String, Object> variables = new HashMap<>();
        for (WfeProcessVariableEntity entity : entities) {
            if (FLOWGRAM_JSON_VAR_KEY.equals(entity.getName())) {
                continue;
            }
            variables.put(entity.getName(), parseVariableValue(entity.getValue()));
        }
        return variables;
    }

    private Object parseVariableValue(String value) {
        if (value == null || value.isEmpty()) {
            return null;
        }
        try {
            return objectMapper.readValue(value, Object.class);
        } catch (Exception e) {
            return value;
        }
    }

    private void saveFlowgramJson(String tenantId, String processInstanceId, String flowgramJson) {
        WfeProcessVariableEntity entity = WfeProcessVariableEntity.builder()
                .id(UUID.randomUUID().toString())
                .tenantId(tenantId)
                .processInstanceId(processInstanceId)
                .name(FLOWGRAM_JSON_VAR_KEY)
                .value(flowgramJson)
                .build();
        variableRepository.save(entity);
    }

    private String loadFlowgramJson(String tenantId, String processInstanceId,
                                    String processDefinitionId) {
        return variableRepository
                .findByTenantIdAndProcessInstanceIdAndName(
                        tenantId, processInstanceId, FLOWGRAM_JSON_VAR_KEY)
                .map(WfeProcessVariableEntity::getValue)
                .orElseGet(() -> {
                    if (processDefinitionId == null) {
                        throw new WfeException(ErrorCode.PROCESS_EXECUTION_FAILED,
                                "FlowGram JSON 未找到且无法从 BPMN 转换（processDefinitionId 为空）");
                    }
                    ProcessDefinitionEntity pd = processDefinitionRepository
                            .findById(processDefinitionId)
                            .orElseThrow(() -> new WfeException(ErrorCode.PROCESS_DEFINITION_NOT_FOUND));
                    Map<String, Object> converted = bpmnToFlowGramConverter.convert(pd.getBpmnXml());
                    if (converted == null) {
                        return null;
                    }
                    try {
                        return objectMapper.writeValueAsString(converted);
                    } catch (Exception e) {
                        throw new WfeException(ErrorCode.PROCESS_EXECUTION_FAILED,
                                "FlowGram JSON 序列化失败: " + e.getMessage());
                    }
                });
    }

}
