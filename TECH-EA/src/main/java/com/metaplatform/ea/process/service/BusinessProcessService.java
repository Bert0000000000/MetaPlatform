package com.metaplatform.ea.process.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.ea.common.ErrorCode;
import com.metaplatform.ea.common.TenantContext;
import com.metaplatform.ea.exception.EaException;
import com.metaplatform.ea.process.dto.CreateBusinessProcessRequest;
import com.metaplatform.ea.process.dto.BusinessProcessResponse;
import com.metaplatform.ea.process.dto.UpdateBusinessProcessRequest;
import com.metaplatform.ea.process.entity.BusinessProcessEntity;
import com.metaplatform.ea.process.repository.BusinessProcessRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class BusinessProcessService {

    private final BusinessProcessRepository repository;
    private final BusinessProcessVersionRepository versionRepository;
    private final ObjectMapper objectMapper;

    @Transactional
    public BusinessProcessResponse create(CreateBusinessProcessRequest request) {
        String tenantId = TenantContext.getOrDefault();
        if (repository.existsByTenantIdAndCodeAndDeletedAtIsNull(tenantId, request.getCode())) {
            throw new EaException(ErrorCode.ALREADY_EXISTS, "业务流程编码已存在: " + request.getCode());
        }
        Instant now = Instant.now();
        BusinessProcessEntity entity = BusinessProcessEntity.builder()
                .tenantId(tenantId)
                .name(request.getName())
                .code(request.getCode())
                .description(request.getDescription())
                .valueStreamId(request.getValueStreamId())
                .capabilities(writeJson(request.getCapabilities() != null ? request.getCapabilities() : List.of()))
                .processSteps(writeJson(request.getProcessSteps() != null ? request.getProcessSteps() : List.of()))
                .version(1)
                .status("DRAFT")
                .createdAt(now)
                .updatedAt(now)
                .build();
        return toResponse(repository.save(entity));
    }

    @Transactional(readOnly = true)
    public List<BusinessProcessResponse> list() {
        String tenantId = TenantContext.getOrDefault();
        return repository.findByTenantIdAndDeletedAtIsNull(tenantId).stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public BusinessProcessResponse get(UUID id) {
        return toResponse(findById(id));
    }

    @Transactional
    public BusinessProcessResponse update(UUID id, UpdateBusinessProcessRequest request) {
        BusinessProcessEntity entity = findById(id);
        if (StringUtils.hasText(request.getName())) entity.setName(request.getName());
        if (request.getDescription() != null) entity.setDescription(request.getDescription());
        if (request.getValueStreamId() != null) entity.setValueStreamId(request.getValueStreamId());
        if (request.getCapabilities() != null) entity.setCapabilities(writeJson(request.getCapabilities()));
        if (request.getProcessSteps() != null) {
            entity.setProcessSteps(writeJson(request.getProcessSteps()));
            entity.setVersion(entity.getVersion() + 1);
        }
        if (StringUtils.hasText(request.getStatus())) entity.setStatus(request.getStatus().toUpperCase());
        entity.setUpdatedAt(Instant.now());
        return toResponse(repository.save(entity));
    }

    // ---------------------------------------------------------- versions

    @Transactional
    public BusinessProcessVersionResponse createVersion(UUID processId,
                                                         CreateProcessVersionRequest request) {
        BusinessProcessEntity entity = findById(processId);
        String tenantId = TenantContext.getOrDefault();
        int nextVersion = entity.getVersion() + 1;
        Instant now = Instant.now();
        BusinessProcessVersionEntity version = BusinessProcessVersionEntity.builder()
                .tenantId(tenantId)
                .processId(processId)
                .version(nextVersion)
                .processSteps(writeJson(request.getProcessSteps() != null ? request.getProcessSteps() : List.of()))
                .flowchart(writeJson(request.getFlowchart() != null ? request.getFlowchart() : Map.of()))
                .changeNote(request.getChangeNote())
                .createdAt(now)
                .build();
        BusinessProcessVersionEntity saved = versionRepository.save(version);

        // Update the head version pointer on the process itself.
        entity.setProcessSteps(saved.getProcessSteps());
        entity.setVersion(nextVersion);
        entity.setUpdatedAt(now);
        repository.save(entity);

        return toVersionResponse(saved);
    }

    @Transactional(readOnly = true)
    public List<BusinessProcessVersionResponse> listVersions(UUID processId) {
        findById(processId);
        return versionRepository.findByProcessIdOrderByVersionDesc(processId)
                .stream().map(this::toVersionResponse).toList();
    }

    @Transactional(readOnly = true)
    public BusinessProcessVersionResponse getVersion(UUID processId, Integer version) {
        findById(processId);
        BusinessProcessVersionEntity v = versionRepository.findByProcessIdAndVersion(processId, version)
                .orElseThrow(() -> new EaException(ErrorCode.NOT_FOUND, "流程版本不存在"));
        return toVersionResponse(v);
    }

    // ----------------------------------------------------- flowchart

    @Transactional(readOnly = true)
    public Map<String, Object> getFlowchart(UUID processId) {
        BusinessProcessEntity entity = findById(processId);
        return readFlowchart(buildFlowchartFromSteps(entity));
    }

    private Map<String, Object> buildFlowchartFromSteps(BusinessProcessEntity entity) {
        List<Map<String, Object>> steps = readMapList(entity.getProcessSteps());
        Map<String, Object> flowchart = new LinkedHashMap<>();
        flowchart.put("processId", entity.getId());
        flowchart.put("version", entity.getVersion());
        List<Map<String, Object>> nodes = new ArrayList<>();
        List<Map<String, Object>> edges = new ArrayList<>();
        for (int i = 0; i < steps.size(); i++) {
            Map<String, Object> step = steps.get(i);
            String stepId = step.getOrDefault("id", "step-" + (i + 1)).toString();
            nodes.add(Map.of(
                    "id", stepId,
                    "label", step.getOrDefault("name", "Step " + (i + 1)),
                    "type", step.getOrDefault("type", "task")
            ));
            if (i > 0) {
                String prevId = steps.get(i - 1).getOrDefault("id", "step-" + i).toString();
                edges.add(Map.of("source", prevId, "target", stepId));
            }
        }
        flowchart.put("nodes", nodes);
        flowchart.put("edges", edges);
        return flowchart;
    }

    private BusinessProcessVersionResponse toVersionResponse(BusinessProcessVersionEntity v) {
        return BusinessProcessVersionResponse.builder()
                .id(v.getId())
                .processId(v.getProcessId())
                .version(v.getVersion())
                .processSteps(readMapList(v.getProcessSteps()))
                .flowchart(readFlowchart(v.getFlowchart()))
                .changeNote(v.getChangeNote())
                .createdBy(v.getCreatedBy())
                .createdAt(v.getCreatedAt())
                .build();
    }

    @Transactional
    public void delete(UUID id) {
        BusinessProcessEntity entity = findById(id);
        Instant now = Instant.now();
        entity.setDeletedAt(now);
        entity.setUpdatedAt(now);
        repository.save(entity);
    }

    private BusinessProcessEntity findById(UUID id) {
        String tenantId = TenantContext.getOrDefault();
        return repository.findByIdAndDeletedAtIsNull(id)
                .filter(e -> e.getTenantId().equals(tenantId))
                .orElseThrow(() -> new EaException(ErrorCode.NOT_FOUND, "业务流程不存在"));
    }

    @SuppressWarnings("unchecked")
    private List<String> readUuidList(String json) {
        if (json == null || json.isBlank()) return List.of();
        try {
            List<?> list = objectMapper.readValue(json, new TypeReference<List<?>>() {});
            return list.stream().map(Object::toString).toList();
        } catch (Exception e) {
            return List.of();
        }
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> readMapList(String json) {
        if (json == null || json.isBlank()) return List.of();
        try {
            return objectMapper.readValue(json, new TypeReference<>() {});
        } catch (Exception e) {
            return List.of();
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> readFlowchart(String json) {
        if (json == null || json.isBlank()) return Map.of();
        try {
            return objectMapper.readValue(json, new TypeReference<Map<String, Object>>() {});
        } catch (Exception e) {
            return Map.of();
        }
    }

    private String writeJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception e) {
            throw new EaException(ErrorCode.INTERNAL_ERROR, "JSON 序列化失败");
        }
    }

    private BusinessProcessResponse toResponse(BusinessProcessEntity entity) {
        return BusinessProcessResponse.builder()
                .id(entity.getId())
                .tenantId(entity.getTenantId())
                .name(entity.getName())
                .code(entity.getCode())
                .description(entity.getDescription())
                .valueStreamId(entity.getValueStreamId())
                .capabilities(readUuidList(entity.getCapabilities()))
                .processSteps(readMapList(entity.getProcessSteps()))
                .version(entity.getVersion())
                .status(entity.getStatus())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }
}
