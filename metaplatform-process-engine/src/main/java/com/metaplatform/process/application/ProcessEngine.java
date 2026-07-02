package com.metaplatform.process.application;

import com.metaplatform.process.domain.ProcessDefinition;
import com.metaplatform.process.domain.ProcessHistoryEvent;
import com.metaplatform.process.domain.ProcessInstance;
import com.metaplatform.process.domain.ProcessTask;
import com.metaplatform.process.domain.dsl.*;
import com.metaplatform.process.domain.enums.*;
import com.metaplatform.process.domain.repository.ProcessDefinitionRepository;
import com.metaplatform.process.domain.repository.ProcessHistoryRepository;
import com.metaplatform.process.domain.repository.ProcessInstanceRepository;
import com.metaplatform.process.domain.repository.ProcessTaskRepository;
import com.metaplatform.process.infrastructure.exception.ProcessDefinitionNotFoundException;
import com.metaplatform.process.infrastructure.exception.ProcessEngineException;
import com.metaplatform.process.infrastructure.util.JsonUtils;
import com.googlecode.aviator.AviatorEvaluator;
import jakarta.transaction.Transactional;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.*;

@Service
@Transactional
public class ProcessEngine {

    private final ProcessInstanceRepository instanceRepository;
    private final ProcessDefinitionRepository definitionRepository;
    private final ProcessTaskRepository taskRepository;
    private final ProcessHistoryRepository historyRepository;
    private final DslParser dslParser;
    private final DefinitionValidator validator;
    private final ParticipantResolver participantResolver;
    private final SlaTracker slaTracker;

    public ProcessEngine(ProcessInstanceRepository instanceRepository,
                         ProcessDefinitionRepository definitionRepository,
                         ProcessTaskRepository taskRepository,
                         ProcessHistoryRepository historyRepository,
                         DslParser dslParser,
                         DefinitionValidator validator,
                         ParticipantResolver participantResolver,
                         SlaTracker slaTracker) {
        this.instanceRepository = instanceRepository;
        this.definitionRepository = definitionRepository;
        this.taskRepository = taskRepository;
        this.historyRepository = historyRepository;
        this.dslParser = dslParser;
        this.validator = validator;
        this.participantResolver = participantResolver;
        this.slaTracker = slaTracker;
    }

    /**
     * Start a new process instance
     */
    public ProcessInstance startProcess(String definitionCode, String initiatorId,
                                         String businessKey, Map<String, Object> variables) {
        // 1. Load process definition
        ProcessDefinition definition = definitionRepository
            .findByCodeAndStatus(definitionCode, DefinitionStatus.ACTIVE)
            .orElseThrow(() -> new ProcessDefinitionNotFoundException(definitionCode));

        // 2. Parse DSL
        ProcessDsl dsl = dslParser.parse(definition.getDslJson());

        // 3. Create process instance
        ProcessInstance instance = new ProcessInstance();
        instance.setDefinitionId(definition.getId());
        instance.setDefinitionCode(definitionCode);
        instance.setStatus(InstanceStatus.RUNNING);
        instance.setInitiatorId(initiatorId);
        instance.setBusinessKey(businessKey);
        instance.setVariablesJson(JsonUtils.toJson(variables != null ? variables : new HashMap<>()));
        instance.setStartedAt(LocalDateTime.now());
        instance.setUpdatedAt(LocalDateTime.now());

        // 4. Find START node, advance to next
        ProcessNode startNode = dsl.getStartNode();
        instance.setCurrentNodeId(startNode.getId());

        instance = instanceRepository.save(instance);

        // 5. Record history
        recordHistory(instance, HistoryEventType.INSTANCE_STARTED, startNode.getId(), initiatorId, null);

        // 6. Auto-advance (START node typically goes directly to next)
        advance(instance, dsl);

        return instance;
    }

    /**
     * Advance process to next node
     */
    public void advance(ProcessInstance instance, ProcessDsl dsl) {
        String currentNodeId = instance.getCurrentNodeId();
        ProcessNode currentNode = dsl.getNodeById(currentNodeId);

        // Get outgoing edges
        List<Transition> outgoing = dsl.getOutgoingTransitions(currentNodeId);

        if (outgoing.isEmpty()) {
            // No outgoing edges -> process ends (should only be at END node)
            if (currentNode.getType() == NodeType.END) {
                completeInstance(instance, currentNode);
            }
            return;
        }

        // Handle based on node type
        switch (currentNode.getType()) {
            case START -> {
                // START node: jump to sole outgoing edge
                Transition next = outgoing.get(0);
                moveToNode(instance, dsl, next.getTo());
            }
            case GATEWAY -> {
                evaluateGateway(instance, dsl, currentNode, outgoing);
            }
            case TASK -> {
                createTaskForNode(instance, currentNode);
                // TASK node waits for external completion, no auto-advance
            }
            case END -> {
                completeInstance(instance, currentNode);
            }
            default -> {
                // SUBPROCESS not implemented in v0.1
            }
        }
    }

    /**
     * Evaluate gateway node
     */
    private void evaluateGateway(ProcessInstance instance, ProcessDsl dsl,
                                  ProcessNode gateway, List<Transition> outgoing) {
        Map<String, Object> variables = JsonUtils.fromJson(instance.getVariablesJson(), Map.class);

        recordHistory(instance, HistoryEventType.GATEWAY_EVALUATED, gateway.getId(), "SYSTEM", null);

        if (gateway.getGatewayType() == GatewayType.XOR) {
            // XOR: find first condition that evaluates to true
            for (Transition transition : outgoing) {
                if (evaluateCondition(transition.getCondition(), variables, instance)) {
                    moveToNode(instance, dsl, transition.getTo());
                    return;
                }
            }
            throw new ProcessEngineException(
                "XOR gateway '" + gateway.getId() + "' has no matching condition branch");
        } else if (gateway.getGatewayType() == GatewayType.AND) {
            // AND: parallel gateway (v0.1 simplified to sequential execution)
            for (Transition transition : outgoing) {
                moveToNode(instance, dsl, transition.getTo());
            }
        }
    }

    /**
     * Evaluate condition expression using Aviator
     */
    public boolean evaluateCondition(String expression, Map<String, Object> variables,
                                       ProcessInstance instance) {
        if (expression == null || expression.isBlank()) return true;

        try {
            // Build execution environment
            Map<String, Object> env = new HashMap<>(variables);
            env.put("taskResult", instance.getTasks().stream()
                .filter(t -> t.getStatus() == TaskStatus.COMPLETED)
                .reduce((a, b) -> b) // take last
                .map(ProcessTask::getResult)
                .orElse(null));
            env.put("initiatorId", instance.getInitiatorId());

            // Replace getVariable('xxx') with actual values
            String processed = expression;
            for (Map.Entry<String, Object> entry : variables.entrySet()) {
                processed = processed.replace(
                    "getVariable('" + entry.getKey() + "')",
                    formatValue(entry.getValue()));
            }

            Object result = AviatorEvaluator.execute(processed, env, true);
            return Boolean.TRUE.equals(result);
        } catch (Exception e) {
            throw new ProcessEngineException(
                "Condition expression evaluation failed: " + expression + " - " + e.getMessage(), e);
        }
    }

    /**
     * Move to specified node
     */
    private void moveToNode(ProcessInstance instance, ProcessDsl dsl, String targetNodeId) {
        instance.setCurrentNodeId(targetNodeId);
        instance.setUpdatedAt(LocalDateTime.now());
        instanceRepository.save(instance);

        recordHistory(instance, HistoryEventType.NODE_ENTERED, targetNodeId, "SYSTEM", null);

        // Recursive advance
        advance(instance, dsl);
    }

    /**
     * Complete process instance
     */
    private void completeInstance(ProcessInstance instance, ProcessNode endNode) {
        instance.setStatus(InstanceStatus.COMPLETED);
        instance.setCompletedAt(LocalDateTime.now());
        instance.setUpdatedAt(LocalDateTime.now());

        // Execute end node action
        if (endNode.getAction() != null) {
            executeAction(instance, endNode.getAction());
        }

        instanceRepository.save(instance);

        recordHistory(instance, HistoryEventType.INSTANCE_COMPLETED, endNode.getId(), "SYSTEM", null);
    }

    /**
     * Execute node action
     */
    private void executeAction(ProcessInstance instance, NodeAction action) {
        if ("SET_VARIABLE".equals(action.getType())) {
            Map<String, Object> variables = JsonUtils.fromJson(instance.getVariablesJson(), Map.class);
            variables.put(action.getVariable(), action.getValue());
            instance.setVariablesJson(JsonUtils.toJson(variables));

            recordHistory(instance, HistoryEventType.VARIABLE_SET, instance.getCurrentNodeId(),
                "SYSTEM", Map.of("variable", action.getVariable(), "value", action.getValue()));
        }
    }

    /**
     * Create task for TASK node
     */
    private void createTaskForNode(ProcessInstance instance, ProcessNode taskNode) {
        String assigneeId = participantResolver.resolve(taskNode.getAssignee(), instance);

        ProcessTask task = new ProcessTask();
        task.setInstanceId(instance.getId());
        task.setNodeId(taskNode.getId());
        task.setTitle(taskNode.getName());
        task.setTaskType(taskNode.getTaskType() != null ? taskNode.getTaskType() : TaskType.MANUAL);
        task.setStatus(TaskStatus.PENDING);
        task.setAssigneeId(assigneeId);
        task.setCreatedAt(LocalDateTime.now());

        // SLA setup
        if (taskNode.getSla() != null) {
            LocalDateTime dueDate = LocalDateTime.now().plus(taskNode.getSla().getDuration());
            task.setDueDate(dueDate);
            slaTracker.scheduleCheck(task, taskNode.getSla());
        }

        task = taskRepository.save(task);

        // Load tasks
        List<ProcessTask> tasks = taskRepository.findByInstanceId(instance.getId());
        instance.setTasks(tasks);

        recordHistory(instance, HistoryEventType.TASK_CREATED, taskNode.getId(), "SYSTEM",
            Map.of("taskId", task.getId(), "assigneeId", assigneeId));
    }

    /**
     * Complete a task (external call, e.g. approve/reject)
     */
    public void completeTask(Long taskId, String assigneeId, String result,
                              String comment, Map<String, Object> formData) {
        ProcessTask task = taskRepository.findById(taskId)
            .orElseThrow(() -> new ProcessEngineException("Task not found: " + taskId));

        if (task.getStatus() != TaskStatus.PENDING) {
            throw new ProcessEngineException("Task already completed or cancelled, cannot operate again");
        }

        if (!task.getAssigneeId().equals(assigneeId)) {
            throw new ProcessEngineException("Only the assignee can complete this task");
        }

        // Update task
        task.setStatus(TaskStatus.COMPLETED);
        task.setResult(result);
        task.setComment(comment);
        task.setFormData(JsonUtils.toJson(formData));
        task.setCompletedAt(LocalDateTime.now());
        taskRepository.save(task);

        // Load instance
        ProcessInstance instance = instanceRepository.findById(task.getInstanceId())
            .orElseThrow(() -> new ProcessEngineException("Instance not found"));

        // If form has variable updates, write to process variables
        if (formData != null && !formData.isEmpty()) {
            Map<String, Object> variables = JsonUtils.fromJson(instance.getVariablesJson(), Map.class);
            variables.putAll(formData);
            instance.setVariablesJson(JsonUtils.toJson(variables));
        }

        // Set taskResult variable
        Map<String, Object> variables = JsonUtils.fromJson(instance.getVariablesJson(), Map.class);
        variables.put("taskResult", result);
        instance.setVariablesJson(JsonUtils.toJson(variables));

        instanceRepository.save(instance);

        recordHistory(instance, HistoryEventType.TASK_COMPLETED, task.getNodeId(), assigneeId,
            Map.of("result", result, "comment", comment != null ? comment : ""));

        // Advance process
        ProcessDefinition definition = definitionRepository
            .findById(instance.getDefinitionId()).orElseThrow();
        ProcessDsl dsl = dslParser.parse(definition.getDslJson());

        // Reload tasks
        instance.setTasks(taskRepository.findByInstanceId(instance.getId()));
        advance(instance, dsl);
    }

    /**
     * Cancel process instance
     */
    public void cancelProcess(Long instanceId, String operatorId, String reason) {
        ProcessInstance instance = instanceRepository.findById(instanceId)
            .orElseThrow(() -> new ProcessEngineException("Instance not found: " + instanceId));

        if (instance.getStatus() != InstanceStatus.RUNNING) {
            throw new ProcessEngineException("Only RUNNING instances can be cancelled");
        }

        instance.setStatus(InstanceStatus.CANCELLED);
        instance.setCompletedAt(LocalDateTime.now());
        instance.setUpdatedAt(LocalDateTime.now());
        instanceRepository.save(instance);

        // Cancel all pending tasks
        List<ProcessTask> tasks = taskRepository.findByInstanceId(instanceId);
        for (ProcessTask task : tasks) {
            if (task.getStatus() == TaskStatus.PENDING) {
                task.setStatus(TaskStatus.CANCELLED);
                taskRepository.save(task);
            }
        }

        recordHistory(instance, HistoryEventType.INSTANCE_CANCELLED,
            instance.getCurrentNodeId(), operatorId,
            reason != null ? Map.of("reason", reason) : null);
    }

    private void recordHistory(ProcessInstance instance, HistoryEventType eventType,
                                String nodeId, String actorId, Object detail) {
        ProcessHistoryEvent event = new ProcessHistoryEvent();
        event.setInstanceId(instance.getId());
        event.setEventType(eventType);
        event.setNodeId(nodeId);
        event.setActorId(actorId);
        event.setDetail(detail != null ? JsonUtils.toJson(detail) : null);
        event.setTimestamp(LocalDateTime.now());
        historyRepository.save(event);
    }

    private String formatValue(Object value) {
        if (value instanceof String) return "'" + value + "'";
        return String.valueOf(value);
    }
}
