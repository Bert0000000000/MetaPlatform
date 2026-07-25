package com.metaplatform.wfe.service;

import com.metaplatform.wfe.common.ErrorCode;
import com.metaplatform.wfe.common.PageResponse;
import com.metaplatform.wfe.common.TenantContext;
import com.metaplatform.wfe.common.TraceContext;
import com.metaplatform.wfe.dto.BindVariableRequest;
import com.metaplatform.wfe.dto.ProcessInstanceResponse;
import com.metaplatform.wfe.dto.RouteDecision;
import com.metaplatform.wfe.dto.StartProcessInstanceRequest;
import com.metaplatform.wfe.engine.WfeStateMachineEngine;
import com.metaplatform.wfe.engine.converter.BpmnToFlowGramConverter;
import com.metaplatform.wfe.entity.ProcessDefinitionEntity;
import com.metaplatform.wfe.entity.ProcessDefinitionStatus;
import com.metaplatform.wfe.entity.ProcessInstanceEntity;
import com.metaplatform.wfe.entity.ProcessInstanceStatus;
import com.metaplatform.wfe.entity.WfeProcessVariableEntity;
import com.metaplatform.wfe.entity.WfeTaskEntity;
import com.metaplatform.wfe.exception.WfeException;
import com.metaplatform.wfe.repository.ProcessDefinitionRepository;
import com.metaplatform.wfe.repository.ProcessInstanceRepository;
import com.metaplatform.wfe.repository.WfeProcessVariableRepository;
import com.metaplatform.wfe.repository.WfeTaskRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class ProcessInstanceService {

    private final ProcessInstanceRepository processInstanceRepository;
    private final ProcessDefinitionRepository processDefinitionRepository;
    private final WfeStateMachineEngine wfeStateMachineEngine;
    private final WfeTaskRepository wfeTaskRepository;
    private final BpmnToFlowGramConverter bpmnToFlowGramConverter;
    private final WfeProcessVariableRepository wfeProcessVariableRepository;
    private final RuleIntegrationService ruleIntegrationService;
    private final OntIntegrationService ontIntegrationService;
    private final WfeOutboxService wfeOutboxService;
    private final ObjectMapper objectMapper;

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

        // 优先使用流程定义中预存的 FlowGram JSON，否则现场将 BPMN XML 转换为 FlowGram JSON
        Map<String, Object> flowgramJson = pdEntity.getFlowgramJson();
        if (flowgramJson == null || flowgramJson.isEmpty()) {
            if (pdEntity.getBpmnXml() == null || pdEntity.getBpmnXml().isEmpty()) {
                throw new WfeException(ErrorCode.PROCESS_EXECUTION_FAILED,
                        "流程定义缺少 BPMN XML 与 FlowGram JSON，无法启动: key=" + pdEntity.getProcessKey());
            }
            flowgramJson = bpmnToFlowGramConverter.convert(extractBpmnXmlString(pdEntity.getBpmnXml()));
        }

        // 生成 UUID 作为流程实例 ID（不再依赖 Flowable 返回的 ID）
        String instanceId = UUID.randomUUID().toString();

        ProcessInstanceEntity entity = ProcessInstanceEntity.builder()
                .id(instanceId)
                .tenantId(tenantId)
                .processDefinitionId(pdEntity.getId())
                .processKey(pdEntity.getProcessKey())
                .businessKey(request.getBusinessKey())
                .status(ProcessInstanceStatus.RUNNING)
                .startUserId(startUserId)
                .variables(variables)
                .build();

        ProcessInstanceEntity saved = processInstanceRepository.save(entity);
        log.info("Process instance created: id={}, processKey={}, startUser={}",
                saved.getId(), saved.getProcessKey(), startUserId);

        // 启动自研状态机引擎，执行首节点链（生成首个审批任务或直接结束）
        try {
            wfeStateMachineEngine.startProcess(tenantId, instanceId, flowgramJson, startUserId, variables);
        } catch (WfeException e) {
            throw e;
        } catch (Exception e) {
            log.error("Failed to start process instance, processKey={}, error={}",
                    pdEntity.getProcessKey(), e.getMessage());
            throw new WfeException(ErrorCode.PROCESS_EXECUTION_FAILED,
                    "流程实例启动失败: " + e.getMessage());
        }

        // 启动后流程实例状态可能已被引擎更新（COMPLETED），重新加载一次
        ProcessInstanceEntity refreshed = processInstanceRepository.findById(instanceId).orElse(saved);

        // P1-WFE-09: 发布 TASK_CREATED 事件（如果流程启动后有第一个任务）
        publishFirstTaskCreated(tenantId, refreshed.getId());

        return toResponse(refreshed);
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

        // 调用自研状态机引擎终止流程（内部会更新 ACTIVE 任务为 TERMINATED + 更新实例状态）
        wfeStateMachineEngine.terminateProcess(id, "TERMINATED");
        log.info("Process instance terminated: id={}", id);
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

        Map<String, Object> variables = entity.getVariables();
        if (variables == null) {
            variables = new HashMap<>();
        } else {
            variables = new HashMap<>(variables);
        }
        variables.put(request.getVariableName(), entityData);
        entity.setVariables(variables);
        processInstanceRepository.save(entity);

        // 同步到自研状态机的流程变量表（upsert 语义）
        upsertProcessVariable(tenantId, processInstanceId, request.getVariableName(), entityData);

        log.info("Process variable bound: processInstanceId={}, variableName={}, conceptCode={}, entityCode={}",
                processInstanceId, request.getVariableName(), request.getConceptCode(), request.getEntityCode());
        return toResponse(entity);
    }

    // ════════════════════════════════════════════
    // P1-WFE-09: 发布首个任务创建事件
    // ════════════════════════════════════════════

    private void publishFirstTaskCreated(String tenantId, String processInstanceId) {
        try {
            // 从自研任务表取首个 ACTIVE 任务（按创建时间倒序的第一条）
            List<WfeTaskEntity> tasks = wfeTaskRepository
                    .findByTenantIdAndProcessInstanceIdOrderByCreatedAtDesc(tenantId, processInstanceId);
            WfeTaskEntity firstTask = tasks.stream()
                    .filter(t -> "ACTIVE".equals(t.getStatus()))
                    .findFirst()
                    .orElse(null);
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

    private void upsertProcessVariable(String tenantId, String processInstanceId,
                                       String name, Object value) {
        String valueStr = wrapAsString(value);
        WfeProcessVariableEntity existing = wfeProcessVariableRepository
                .findByTenantIdAndProcessInstanceIdAndName(tenantId, processInstanceId, name)
                .orElse(null);
        if (existing != null) {
            existing.setValue(valueStr);
            wfeProcessVariableRepository.save(existing);
        } else {
            WfeProcessVariableEntity entity = WfeProcessVariableEntity.builder()
                    .id(UUID.randomUUID().toString())
                    .tenantId(tenantId)
                    .processInstanceId(processInstanceId)
                    .name(name)
                    .value(valueStr)
                    .build();
            wfeProcessVariableRepository.save(entity);
        }
    }

    private String wrapAsString(Object value) {
        try {
            return objectMapper.writeValueAsString(Map.of("value", value));
        } catch (Exception e) {
            throw new WfeException(ErrorCode.PROCESS_EXECUTION_FAILED,
                    "流程变量序列化失败: " + e.getMessage());
        }
    }

    private String extractBpmnXmlString(Map<String, Object> bpmnXml) {
        if (bpmnXml == null) {
            return null;
        }
        Object xml = bpmnXml.get("xml");
        if (xml == null) {
            xml = bpmnXml.get("text");
        }
        if (xml == null) {
            xml = bpmnXml.get("content");
        }
        return xml == null ? null : xml.toString();
    }

    private ProcessInstanceEntity findById(String id) {
        String tenantId = TenantContext.get();
        return processInstanceRepository
                .findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new WfeException(ErrorCode.PROCESS_INSTANCE_NOT_FOUND));
    }

    private ProcessInstanceResponse toResponse(ProcessInstanceEntity entity) {
        return ProcessInstanceResponse.builder()
                .id(entity.getId())
                .tenantId(entity.getTenantId())
                .processDefinitionId(entity.getProcessDefinitionId())
                .processKey(entity.getProcessKey())
                .businessKey(entity.getBusinessKey())
                .status(entity.getStatus() == null ? null : entity.getStatus().name())
                .startUserId(entity.getStartUserId())
                .variables(entity.getVariables())
                .createdAt(entity.getCreatedAt())
                .completedAt(entity.getCompletedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }
}
