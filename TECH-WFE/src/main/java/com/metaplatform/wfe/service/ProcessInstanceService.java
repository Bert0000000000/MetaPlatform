package com.metaplatform.wfe.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.wfe.common.ErrorCode;
import com.metaplatform.wfe.common.PageResponse;
import com.metaplatform.wfe.common.TenantContext;
import com.metaplatform.wfe.common.TraceContext;
import com.metaplatform.wfe.dto.BindVariableRequest;
import com.metaplatform.wfe.dto.ProcessInstanceResponse;
import com.metaplatform.wfe.dto.RouteDecision;
import com.metaplatform.wfe.dto.StartProcessInstanceRequest;
import com.metaplatform.wfe.entity.ProcessDefinitionEntity;
import com.metaplatform.wfe.entity.ProcessDefinitionStatus;
import com.metaplatform.wfe.entity.ProcessInstanceEntity;
import com.metaplatform.wfe.entity.ProcessInstanceStatus;
import com.metaplatform.wfe.exception.WfeException;
import com.metaplatform.wfe.repository.ProcessDefinitionRepository;
import com.metaplatform.wfe.repository.ProcessInstanceRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.flowable.engine.RepositoryService;
import org.flowable.engine.RuntimeService;
import org.flowable.engine.TaskService;
import org.flowable.engine.repository.ProcessDefinition;
import org.flowable.engine.repository.ProcessDefinitionQuery;
import org.flowable.engine.runtime.ProcessInstance;
import org.flowable.task.api.Task;
import org.flowable.task.api.TaskQuery;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class ProcessInstanceService {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    private final ProcessInstanceRepository processInstanceRepository;
    private final ProcessDefinitionRepository processDefinitionRepository;
    private final RuntimeService runtimeService;
    private final RepositoryService repositoryService;
    private final TaskService taskService;
    private final RuleIntegrationService ruleIntegrationService;
    private final OntIntegrationService ontIntegrationService;
    private final WfeOutboxService wfeOutboxService;

    @Transactional
    public ProcessInstanceResponse start(StartProcessInstanceRequest request) {
        String tenantId = TenantContext.get();
        String startUserId = TenantContext.getUserId();

        ProcessDefinitionEntity pdEntity = processDefinitionRepository
                .findByIdAndStatusNot(request.getProcessDefinitionId(), ProcessDefinitionStatus.DELETED)
                .orElseThrow(() -> new WfeException(ErrorCode.PROCESS_DEFINITION_NOT_FOUND));

        if (!tenantId.equals(pdEntity.getTenantId())) {
            throw new WfeException(ErrorCode.TENANT_MISMATCH);
        }

        String flowablePdId = resolveFlowableProcessDefinitionId(pdEntity.getProcessKey());

        Map<String, Object> variables = request.getVariables();
        if (variables == null) {
            variables = new HashMap<>();
        } else {
            variables = new HashMap<>(variables);
        }

        // P1-WFE-07: 如果 variables 中包含 _ruleset_code，自动调用规则引擎进行网关路由决策
        if (variables.containsKey("_ruleset_code")) {
            String rulesetCode = String.valueOf(variables.get("_ruleset_code"));
            RouteDecision decision = ruleIntegrationService.evaluateGateway(tenantId, rulesetCode, variables);
            variables.put("_route_decision", decision);
            log.info("Route decision applied: processKey={}, rulesetCode={}, decision={}",
                    pdEntity.getProcessKey(), rulesetCode, decision);
        }

        ProcessInstance flowableInstance;
        try {
            flowableInstance = runtimeService.startProcessInstanceById(
                    flowablePdId, request.getBusinessKey(), variables);
        } catch (Exception e) {
            log.error("Failed to start process instance, processKey={}, error={}",
                    pdEntity.getProcessKey(), e.getMessage());
            throw new WfeException(ErrorCode.PROCESS_EXECUTION_FAILED,
                    "流程实例启动失败: " + e.getMessage());
        }

        ProcessInstanceEntity entity = ProcessInstanceEntity.builder()
                .id(flowableInstance.getId())
                .tenantId(tenantId)
                .processDefinitionId(pdEntity.getId())
                .processKey(pdEntity.getProcessKey())
                .businessKey(request.getBusinessKey())
                .status(ProcessInstanceStatus.RUNNING)
                .startUserId(startUserId)
                .variables(toJson(variables))
                .build();

        ProcessInstanceEntity saved = processInstanceRepository.save(entity);
        log.info("Process instance started: id={}, processKey={}, startUser={}",
                saved.getId(), saved.getProcessKey(), startUserId);

        // P1-WFE-09: 发布 TASK_CREATED 事件（如果流程启动后有第一个任务）
        publishFirstTaskCreated(tenantId, saved.getId());

        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public PageResponse<ProcessInstanceResponse> list(
            String tenantId, ProcessInstanceStatus status, int page, int size) {
        String effectiveTenantId = tenantId != null ? tenantId : TenantContext.get();
        PageRequest pageRequest = PageRequest.of(Math.max(0, page - 1), Math.max(1, size),
                Sort.by(Sort.Direction.DESC, "createdAt"));

        Page<ProcessInstanceEntity> result;
        if (status != null) {
            result = processInstanceRepository.findByTenantIdAndStatus(
                    effectiveTenantId, status, pageRequest);
        } else {
            result = processInstanceRepository.findByTenantId(effectiveTenantId, pageRequest);
        }

        return PageResponse.<ProcessInstanceResponse>builder()
                .items(result.getContent().stream().map(this::toResponse).toList())
                .total(result.getTotalElements())
                .page(page)
                .pageSize(size)
                .totalPages(result.getTotalPages())
                .build();
    }

    @Transactional(readOnly = true)
    public ProcessInstanceResponse getById(String id) {
        return toResponse(findById(id));
    }

    @Transactional
    public void terminate(String id) {
        ProcessInstanceEntity entity = findById(id);
        if (entity.getStatus() == ProcessInstanceStatus.TERMINATED) {
            throw new WfeException(ErrorCode.STATE_CONFLICT, "流程实例已终止");
        }
        if (entity.getStatus() == ProcessInstanceStatus.COMPLETED) {
            throw new WfeException(ErrorCode.STATE_CONFLICT, "流程实例已完成，不可终止");
        }

        try {
            runtimeService.deleteProcessInstance(id, "TERMINATED");
            log.info("Flowable process instance deleted: id={}", id);
        } catch (Exception e) {
            log.warn("Flowable deleteProcessInstance failed for id={}, continuing with DB update: {}",
                    id, e.getMessage());
        }

        entity.setStatus(ProcessInstanceStatus.TERMINATED);
        processInstanceRepository.save(entity);
    }

    // ════════════════════════════════════════════
    // P1-WFE-08: 流程变量绑定业务对象
    // ════════════════════════════════════════════

    @Transactional
    public ProcessInstanceResponse bindVariable(String processInstanceId, BindVariableRequest request) {
        String tenantId = TenantContext.get();
        ProcessInstanceEntity entity = findById(processInstanceId);

        // 调用 ONT 获取业务对象实体并绑定到流程变量
        Map<String, Object> entityData = ontIntegrationService.bindProcessVariable(
                tenantId, processInstanceId, request.getVariableName(),
                request.getConceptCode(), request.getEntityCode());

        Map<String, Object> variables = fromJson(entity.getVariables());
        if (variables == null) {
            variables = new HashMap<>();
        } else {
            variables = new HashMap<>(variables);
        }
        variables.put(request.getVariableName(), entityData);
        entity.setVariables(toJson(variables));
        processInstanceRepository.save(entity);

        // 同步到 Flowable 运行时变量
        try {
            runtimeService.setVariable(processInstanceId, request.getVariableName(), entityData);
        } catch (Exception e) {
            log.warn("Failed to sync variable to Flowable runtime: processInstanceId={}, var={}, error={}",
                    processInstanceId, request.getVariableName(), e.getMessage());
        }

        log.info("Process variable bound: processInstanceId={}, variableName={}, conceptCode={}, entityCode={}",
                processInstanceId, request.getVariableName(), request.getConceptCode(), request.getEntityCode());
        return toResponse(entity);
    }

    // ════════════════════════════════════════════
    // P1-WFE-09: 发布首个任务创建事件
    // ════════════════════════════════════════════

    private void publishFirstTaskCreated(String tenantId, String processInstanceId) {
        try {
            TaskQuery query = taskService.createTaskQuery()
                    .processInstanceId(processInstanceId)
                    .active()
                    .orderByTaskCreateTime()
                    .asc();
            Task firstTask = query.listPage(0, 1).stream().findFirst().orElse(null);
            if (firstTask != null) {
                Map<String, Object> payload = new HashMap<>();
                payload.put("taskId", firstTask.getId());
                payload.put("processInstanceId", processInstanceId);
                payload.put("taskName", firstTask.getName());
                payload.put("assignee", firstTask.getAssignee());
                Map<String, String> headers = new HashMap<>();
                headers.put(TraceContext.TRACE_ID_HEADER, TraceContext.getOrCreate());
                wfeOutboxService.publishEvent(tenantId, firstTask.getId(), "TASK_CREATED", payload, headers);
                log.info("TASK_CREATED event published: taskId={}, processInstanceId={}",
                        firstTask.getId(), processInstanceId);
            }
        } catch (Exception e) {
            log.warn("Failed to publish TASK_CREATED event (non-blocking): processInstanceId={}, error={}",
                    processInstanceId, e.getMessage());
        }
    }

    private ProcessInstanceEntity findById(String id) {
        String tenantId = TenantContext.get();
        return processInstanceRepository
                .findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new WfeException(ErrorCode.PROCESS_INSTANCE_NOT_FOUND));
    }

    private String resolveFlowableProcessDefinitionId(String processKey) {
        try {
            ProcessDefinitionQuery query = repositoryService.createProcessDefinitionQuery()
                    .processDefinitionKey(processKey)
                    .latestVersion();
            ProcessDefinition pd = query.singleResult();
            if (pd == null) {
                throw new WfeException(ErrorCode.PROCESS_EXECUTION_FAILED,
                        "流程定义未部署到 Flowable 引擎: key=" + processKey);
            }
            return pd.getId();
        } catch (WfeException e) {
            throw e;
        } catch (Exception e) {
            throw new WfeException(ErrorCode.PROCESS_EXECUTION_FAILED,
                    "查询 Flowable 流程定义失败: " + e.getMessage());
        }
    }

    private String toJson(Map<String, Object> variables) {
        if (variables == null || variables.isEmpty()) {
            return null;
        }
        try {
            return OBJECT_MAPPER.writeValueAsString(variables);
        } catch (JsonProcessingException e) {
            throw new WfeException(ErrorCode.INTERNAL_ERROR, "变量序列化失败");
        }
    }

    private Map<String, Object> fromJson(String json) {
        if (json == null || json.isBlank()) {
            return null;
        }
        try {
            return OBJECT_MAPPER.readValue(json, new TypeReference<Map<String, Object>>() {});
        } catch (JsonProcessingException e) {
            log.warn("Failed to deserialize variables: {}", e.getMessage());
            return null;
        }
    }

    private ProcessInstanceResponse toResponse(ProcessInstanceEntity entity) {
        return ProcessInstanceResponse.builder()
                .id(entity.getId())
                .tenantId(entity.getTenantId())
                .processDefinitionId(entity.getProcessDefinitionId())
                .processKey(entity.getProcessKey())
                .businessKey(entity.getBusinessKey())
                .status(entity.getStatus().name())
                .startUserId(entity.getStartUserId())
                .variables(fromJson(entity.getVariables()))
                .createdAt(entity.getCreatedAt())
                .completedAt(entity.getCompletedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }
}
