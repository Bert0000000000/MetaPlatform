package com.metaplatform.wfe.service;

import com.metaplatform.wfe.common.ErrorCode;
import com.metaplatform.wfe.common.PageResponse;
import com.metaplatform.wfe.common.TenantContext;
import com.metaplatform.wfe.dto.DeployRequest;
import com.metaplatform.wfe.dto.ProcessDefinitionResponse;
import com.metaplatform.wfe.engine.converter.BpmnToFlowGramConverter;
import com.metaplatform.wfe.entity.ProcessDefinitionEntity;
import com.metaplatform.wfe.entity.ProcessDefinitionStatus;
import com.metaplatform.wfe.exception.WfeException;
import com.metaplatform.wfe.repository.ProcessDefinitionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class ProcessDefinitionService {

    private final ProcessDefinitionRepository processDefinitionRepository;
    private final BpmnToFlowGramConverter bpmnToFlowGramConverter;

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

        // 将 BPMN XML 转换为 FlowGram JSON 供自研状态机引擎执行
        Map<String, Object> flowgramJson = null;
        if (request.getBpmnXml() != null && !request.getBpmnXml().isEmpty()) {
            flowgramJson = bpmnToFlowGramConverter.convert(extractBpmnXmlString(request.getBpmnXml()));
            log.info("BPMN converted to FlowGram JSON: processKey={}, version={}", processKey, nextVersion);
        }

        ProcessDefinitionEntity entity = ProcessDefinitionEntity.builder()
                .id(UUID.randomUUID().toString())
                .tenantId(tenantId)
                .processKey(processKey)
                .name(request.getName())
                .version(nextVersion)
                .bpmnXml(request.getBpmnXml())
                .flowgramJson(flowgramJson)
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

        entity.setStatus(ProcessDefinitionStatus.SUSPENDED);
        ProcessDefinitionEntity saved = processDefinitionRepository.save(entity);
        log.info("Process definition suspended: id={}, processKey={}", id, entity.getProcessKey());
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

        entity.setStatus(ProcessDefinitionStatus.DEPLOYED);
        ProcessDefinitionEntity saved = processDefinitionRepository.save(entity);
        log.info("Process definition activated: id={}, processKey={}", id, entity.getProcessKey());
        return toResponse(saved);
    }

    @Transactional
    public void delete(String id) {
        ProcessDefinitionEntity entity = findById(id);
        if (entity.getStatus() == ProcessDefinitionStatus.DELETED) {
            throw new WfeException(ErrorCode.STATE_CONFLICT, "流程定义已删除");
        }

        entity.setStatus(ProcessDefinitionStatus.DELETED);
        processDefinitionRepository.save(entity);
        log.info("Process definition deleted: id={}, processKey={}", id, entity.getProcessKey());
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
                .status(entity.getStatus() == null ? null : entity.getStatus().name())
                .deployedBy(entity.getDeployedBy())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }

    /**
     * 将 BPMN XML Map 表示提取为字符串，兼容多种 DTO 来源。
     */
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
}
