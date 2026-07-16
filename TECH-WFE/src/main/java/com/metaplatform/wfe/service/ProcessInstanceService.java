package com.metaplatform.wfe.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.wfe.common.ErrorCode;
import com.metaplatform.wfe.common.PageResponse;
import com.metaplatform.wfe.common.TenantContext;
import com.metaplatform.wfe.dto.ProcessInstanceResponse;
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
import org.flowable.engine.repository.ProcessDefinition;
import org.flowable.engine.repository.ProcessDefinitionQuery;
import org.flowable.engine.runtime.ProcessInstance;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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
            variables = Map.of();
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

    private ProcessInstanceEntity findById(String id) {
        String tenantId = TenantContext.get();
        ProcessInstanceEntity entity = processInstanceRepository
                .findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new WfeException(ErrorCode.PROCESS_INSTANCE_NOT_FOUND));
        return entity;
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
