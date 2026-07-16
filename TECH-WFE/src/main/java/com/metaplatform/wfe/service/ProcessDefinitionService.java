package com.metaplatform.wfe.service;

import com.metaplatform.wfe.common.ErrorCode;
import com.metaplatform.wfe.common.PageResponse;
import com.metaplatform.wfe.common.TenantContext;
import com.metaplatform.wfe.dto.DeployRequest;
import com.metaplatform.wfe.dto.ProcessDefinitionResponse;
import com.metaplatform.wfe.entity.ProcessDefinitionEntity;
import com.metaplatform.wfe.entity.ProcessDefinitionStatus;
import com.metaplatform.wfe.exception.WfeException;
import com.metaplatform.wfe.repository.ProcessDefinitionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.flowable.engine.RepositoryService;
import org.flowable.engine.repository.Deployment;
import org.flowable.engine.repository.ProcessDefinition;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class ProcessDefinitionService {

    private final ProcessDefinitionRepository processDefinitionRepository;
    private final RepositoryService repositoryService;

    @Transactional
    public ProcessDefinitionResponse deploy(DeployRequest request) {
        String tenantId = TenantContext.get();
        String processKey = request.getProcessKey();

        int nextVersion = processDefinitionRepository
                .findFirstByTenantIdAndProcessKeyAndStatusNotOrderByVersionDesc(
                        tenantId, processKey, ProcessDefinitionStatus.DELETED)
                .map(e -> e.getVersion() + 1)
                .orElse(1);

        if (processDefinitionRepository.existsByTenantIdAndProcessKeyAndVersion(
                tenantId, processKey, nextVersion)) {
            throw new WfeException(ErrorCode.PROCESS_DEFINITION_ALREADY_EXISTS,
                    "流程定义 key=" + processKey + " version=" + nextVersion + " 已存在");
        }

        Deployment deployment = repositoryService.createDeployment()
                .name(request.getName())
                .addString(processKey + ".bpmn20.xml", request.getBpmnXml())
                .deploy();

        log.info("Flowable deployment created: id={}, name={}", deployment.getId(), deployment.getName());

        ProcessDefinitionEntity entity = ProcessDefinitionEntity.builder()
                .id(UUID.randomUUID().toString())
                .tenantId(tenantId)
                .processKey(processKey)
                .name(request.getName())
                .version(nextVersion)
                .bpmnXml(request.getBpmnXml())
                .status(ProcessDefinitionStatus.DEPLOYED)
                .deployedBy(TenantContext.getUserId())
                .build();

        ProcessDefinitionEntity saved = processDefinitionRepository.save(entity);
        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public PageResponse<ProcessDefinitionResponse> list(
            String tenantId, ProcessDefinitionStatus status, int page, int size) {
        String effectiveTenantId = tenantId != null ? tenantId : TenantContext.get();
        PageRequest pageRequest = PageRequest.of(Math.max(0, page - 1), Math.max(1, size),
                Sort.by(Sort.Direction.DESC, "createdAt"));

        Page<ProcessDefinitionEntity> result;
        if (status != null) {
            if (status == ProcessDefinitionStatus.DELETED) {
                result = processDefinitionRepository.findByTenantIdAndStatus(
                        effectiveTenantId, status, pageRequest);
            } else {
                result = processDefinitionRepository.findByTenantIdAndStatusNot(
                        effectiveTenantId, ProcessDefinitionStatus.DELETED, pageRequest);
            }
        } else {
            result = processDefinitionRepository.findByTenantIdAndStatusNot(
                    effectiveTenantId, ProcessDefinitionStatus.DELETED, pageRequest);
        }

        return PageResponse.<ProcessDefinitionResponse>builder()
                .items(result.getContent().stream().map(this::toResponse).toList())
                .total(result.getTotalElements())
                .page(page)
                .pageSize(size)
                .totalPages(result.getTotalPages())
                .build();
    }

    @Transactional(readOnly = true)
    public ProcessDefinitionResponse getById(String id) {
        return toResponse(findById(id));
    }

    @Transactional
    public ProcessDefinitionResponse suspend(String id) {
        ProcessDefinitionEntity entity = findById(id);
        if (entity.getStatus() == ProcessDefinitionStatus.SUSPENDED) {
            throw new WfeException(ErrorCode.STATE_CONFLICT, "流程定义已处于挂起状态");
        }
        if (entity.getStatus() == ProcessDefinitionStatus.DELETED) {
            throw new WfeException(ErrorCode.STATE_CONFLICT, "已删除的流程定义不可挂起");
        }

        callFlowableSuspend(entity.getProcessKey());

        entity.setStatus(ProcessDefinitionStatus.SUSPENDED);
        ProcessDefinitionEntity saved = processDefinitionRepository.save(entity);
        return toResponse(saved);
    }

    @Transactional
    public ProcessDefinitionResponse activate(String id) {
        ProcessDefinitionEntity entity = findById(id);
        if (entity.getStatus() == ProcessDefinitionStatus.DEPLOYED) {
            throw new WfeException(ErrorCode.STATE_CONFLICT, "流程定义已处于激活状态");
        }
        if (entity.getStatus() == ProcessDefinitionStatus.DELETED) {
            throw new WfeException(ErrorCode.STATE_CONFLICT, "已删除的流程定义不可激活");
        }

        callFlowableActivate(entity.getProcessKey());

        entity.setStatus(ProcessDefinitionStatus.DEPLOYED);
        ProcessDefinitionEntity saved = processDefinitionRepository.save(entity);
        return toResponse(saved);
    }

    @Transactional
    public void delete(String id) {
        ProcessDefinitionEntity entity = findById(id);
        if (entity.getStatus() == ProcessDefinitionStatus.DELETED) {
            throw new WfeException(ErrorCode.STATE_CONFLICT, "流程定义已删除");
        }

        callFlowableDelete(entity.getProcessKey());

        entity.setStatus(ProcessDefinitionStatus.DELETED);
        processDefinitionRepository.save(entity);
    }

    private void callFlowableSuspend(String processKey) {
        try {
            ProcessDefinition pd = repositoryService.createProcessDefinitionQuery()
                    .processDefinitionKey(processKey)
                    .latestVersion()
                    .singleResult();
            if (pd != null) {
                repositoryService.suspendProcessDefinitionById(pd.getId());
                log.info("Flowable process definition suspended: key={}, id={}", processKey, pd.getId());
            }
        } catch (Exception e) {
            log.warn("Flowable suspend failed for key={}, continuing with DB update: {}", processKey, e.getMessage());
        }
    }

    private void callFlowableActivate(String processKey) {
        try {
            ProcessDefinition pd = repositoryService.createProcessDefinitionQuery()
                    .processDefinitionKey(processKey)
                    .latestVersion()
                    .singleResult();
            if (pd != null) {
                repositoryService.activateProcessDefinitionById(pd.getId());
                log.info("Flowable process definition activated: key={}, id={}", processKey, pd.getId());
            }
        } catch (Exception e) {
            log.warn("Flowable activate failed for key={}, continuing with DB update: {}", processKey, e.getMessage());
        }
    }

    private void callFlowableDelete(String processKey) {
        try {
            ProcessDefinition pd = repositoryService.createProcessDefinitionQuery()
                    .processDefinitionKey(processKey)
                    .latestVersion()
                    .singleResult();
            if (pd != null) {
                repositoryService.deleteDeployment(pd.getDeploymentId());
                log.info("Flowable deployment deleted: key={}, deploymentId={}", processKey, pd.getDeploymentId());
            }
        } catch (Exception e) {
            log.warn("Flowable delete failed for key={}, continuing with DB soft-delete: {}", processKey, e.getMessage());
        }
    }

    private ProcessDefinitionEntity findById(String id) {
        ProcessDefinitionEntity entity = processDefinitionRepository
                .findByIdAndStatusNot(id, ProcessDefinitionStatus.DELETED)
                .orElseThrow(() -> new WfeException(ErrorCode.PROCESS_DEFINITION_NOT_FOUND));
        String tenantId = TenantContext.get();
        if (!tenantId.equals(entity.getTenantId())) {
            throw new WfeException(ErrorCode.TENANT_MISMATCH);
        }
        return entity;
    }

    private ProcessDefinitionResponse toResponse(ProcessDefinitionEntity entity) {
        return ProcessDefinitionResponse.builder()
                .id(entity.getId())
                .tenantId(entity.getTenantId())
                .processKey(entity.getProcessKey())
                .name(entity.getName())
                .version(entity.getVersion())
                .bpmnXml(entity.getBpmnXml())
                .status(entity.getStatus().name())
                .deployedBy(entity.getDeployedBy())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }
}
