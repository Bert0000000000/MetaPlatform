package com.metaplatform.ea.mapping.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.ea.capability.service.BusinessCapabilityService;
import com.metaplatform.ea.common.ErrorCode;
import com.metaplatform.ea.common.TenantContext;
import com.metaplatform.ea.exception.EaException;
import com.metaplatform.ea.mapping.dto.ConsistencyCheckResponse;
import com.metaplatform.ea.mapping.dto.CreateMappingRequest;
import com.metaplatform.ea.mapping.dto.MapConceptRequest;
import com.metaplatform.ea.mapping.dto.MappingFilterRequest;
import com.metaplatform.ea.mapping.dto.MappingResponse;
import com.metaplatform.ea.mapping.dto.SyncResultResponse;
import com.metaplatform.ea.mapping.dto.UpdateMappingRequest;
import com.metaplatform.ea.mapping.entity.CapabilityConceptMappingEntity;
import com.metaplatform.ea.mapping.repository.CapabilityConceptMappingRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class CapabilityConceptMappingService {

    private static final String TYPE_DIRECT = "DIRECT";
    private static final String TYPE_DERIVED = "DERIVED";
    private static final String TYPE_ABSTRACT = "ABSTRACT";

    private final CapabilityConceptMappingRepository mappingRepository;
    private final BusinessCapabilityService capabilityService;
    private final OntIntegrationService ontIntegrationService;
    private final ObjectMapper objectMapper;

    @Transactional
    public MappingResponse create(CreateMappingRequest request) {
        String tenantId = TenantContext.getOrDefault();
        capabilityService.findById(request.getCapabilityId());
        validateMappingType(request.getMappingType());
        validateJson(request.getMetadata(), "metadata");
        ontIntegrationService.validateConceptExists(request.getConceptId());

        if (mappingRepository.existsByTenantIdAndCapabilityIdAndConceptIdAndDeletedAtIsNull(
                tenantId, request.getCapabilityId(), request.getConceptId())) {
            throw new EaException(ErrorCode.ALREADY_EXISTS, "该能力已映射到此概念");
        }

        Instant now = Instant.now();
        CapabilityConceptMappingEntity entity = CapabilityConceptMappingEntity.builder()
                .tenantId(tenantId)
                .capabilityId(request.getCapabilityId())
                .conceptId(request.getConceptId())
                .conceptCode(request.getConceptCode())
                .mappingType(request.getMappingType())
                .metadata(normalizeJson(request.getMetadata(), "{}"))
                .createdAt(now)
                .updatedAt(now)
                .build();
        CapabilityConceptMappingEntity saved = mappingRepository.save(entity);
        return toResponse(saved);
    }

    @Transactional
    public MappingResponse mapConcept(UUID capabilityId, MapConceptRequest request) {
        CreateMappingRequest createRequest = new CreateMappingRequest();
        createRequest.setCapabilityId(capabilityId);
        createRequest.setConceptId(request.getConceptId());
        createRequest.setConceptCode(request.getConceptCode());
        createRequest.setMappingType(request.getMappingType());
        createRequest.setMetadata(request.getMetadata());
        return create(createRequest);
    }

    @Transactional(readOnly = true)
    public List<MappingResponse> list() {
        String tenantId = TenantContext.getOrDefault();
        return mappingRepository.findByTenantIdAndDeletedAtIsNull(tenantId)
                .stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public List<MappingResponse> listWithFilters(MappingFilterRequest filter) {
        String tenantId = TenantContext.getOrDefault();
        List<CapabilityConceptMappingEntity> all;
        if (filter != null && StringUtils.hasText(filter.getMappingType())) {
            all = mappingRepository.findByTenantIdAndMappingTypeAndDeletedAtIsNull(tenantId, filter.getMappingType().toUpperCase());
        } else {
            all = mappingRepository.findByTenantIdAndDeletedAtIsNull(tenantId);
        }
        String keyword = filter != null && StringUtils.hasText(filter.getKeyword())
                ? filter.getKeyword().toLowerCase() : null;
        return all.stream()
                .filter(m -> keyword == null
                        || (m.getConceptId() != null && m.getConceptId().toLowerCase().contains(keyword))
                        || (m.getConceptCode() != null && m.getConceptCode().toLowerCase().contains(keyword))
                        || (m.getCapabilityId() != null && m.getCapabilityId().toString().toLowerCase().contains(keyword)))
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public ConsistencyCheckResponse checkConsistency() {
        String tenantId = TenantContext.getOrDefault();
        List<CapabilityConceptMappingEntity> mappings = mappingRepository.findByTenantIdAndDeletedAtIsNull(tenantId);
        long direct = mappings.stream().filter(m -> TYPE_DIRECT.equals(m.getMappingType())).count();
        long derived = mappings.stream().filter(m -> TYPE_DERIVED.equals(m.getMappingType())).count();
        long abs = mappings.stream().filter(m -> TYPE_ABSTRACT.equals(m.getMappingType())).count();

        List<ConsistencyCheckResponse.Issue> issues = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        for (CapabilityConceptMappingEntity m : mappings) {
            String key = m.getCapabilityId() + ":" + m.getConceptId();
            if (!seen.add(key)) {
                issues.add(ConsistencyCheckResponse.Issue.builder()
                        .severity("ERROR")
                        .code("DUPLICATE_MAPPING")
                        .message("发现重复的 capability-concept 映射")
                        .entityReference(key)
                        .build());
            }
            if (TYPE_ABSTRACT.equals(m.getMappingType()) && StringUtils.hasText(m.getConceptCode())) {
                issues.add(ConsistencyCheckResponse.Issue.builder()
                        .severity("WARN")
                        .code("ABSTRACT_HAS_CODE")
                        .message("ABSTRACT 类型映射不应包含 conceptCode")
                        .entityReference(m.getId().toString())
                        .build());
            }
        }
        boolean consistent = issues.stream().noneMatch(i -> "ERROR".equals(i.getSeverity()));
        return ConsistencyCheckResponse.builder()
                .consistent(consistent)
                .totalMappings(mappings.size())
                .directMappings(direct)
                .derivedMappings(derived)
                .abstractMappings(abs)
                .issues(issues)
                .summary(String.format("共 %d 条映射，发现 %d 个问题", mappings.size(), issues.size()))
                .build();
    }

    @Transactional
    public SyncResultResponse syncFromOntology(List<OntConceptSnapshot> concepts) {
        String tenantId = TenantContext.getOrDefault();
        List<CapabilityConceptMappingEntity> existing = mappingRepository.findByTenantIdAndDeletedAtIsNull(tenantId);
        Map<String, CapabilityConceptMappingEntity> byConceptId = new HashMap<>();
        for (CapabilityConceptMappingEntity e : existing) {
            byConceptId.put(e.getConceptId(), e);
        }

        int created = 0, updated = 0, skipped = 0;
        List<String> synced = new ArrayList<>();
        Instant now = Instant.now();

        if (concepts == null) {
            return SyncResultResponse.builder()
                    .createdCount(0).updatedCount(0).skippedCount(0).removedCount(0)
                    .syncedConceptIds(List.of())
                    .summary("Ontology 未返回任何概念，跳过同步")
                    .build();
        }

        for (OntConceptSnapshot concept : concepts) {
            if (concept == null || !StringUtils.hasText(concept.getConceptId())) {
                skipped++;
                continue;
            }
            CapabilityConceptMappingEntity existingEntity = byConceptId.get(concept.getConceptId());
            if (existingEntity != null) {
                if (concept.getConceptCode() != null
                        && !concept.getConceptCode().equals(existingEntity.getConceptCode())) {
                    existingEntity.setConceptCode(concept.getConceptCode());
                    existingEntity.setUpdatedAt(now);
                    mappingRepository.save(existingEntity);
                    updated++;
                } else {
                    skipped++;
                }
            } else {
                if (!StringUtils.hasText(concept.getCapabilityId())) {
                    skipped++;
                    continue;
                }
                try {
                    capabilityService.findById(UUID.fromString(concept.getCapabilityId()));
                } catch (Exception ex) {
                    skipped++;
                    continue;
                }
                CapabilityConceptMappingEntity entity = CapabilityConceptMappingEntity.builder()
                        .tenantId(tenantId)
                        .capabilityId(UUID.fromString(concept.getCapabilityId()))
                        .conceptId(concept.getConceptId())
                        .conceptCode(concept.getConceptCode())
                        .mappingType(TYPE_DIRECT)
                        .metadata("{}")
                        .createdAt(now)
                        .updatedAt(now)
                        .build();
                mappingRepository.save(entity);
                created++;
            }
            synced.add(concept.getConceptId());
        }
        return SyncResultResponse.builder()
                .createdCount(created)
                .updatedCount(updated)
                .skippedCount(skipped)
                .removedCount(0)
                .syncedConceptIds(synced)
                .summary(String.format("同步完成：创建 %d / 更新 %d / 跳过 %d", created, updated, skipped))
                .build();
    }

    @Transactional(readOnly = true)
    public MappingResponse get(UUID id) {
        return toResponse(findById(id));
    }

    @Transactional
    public MappingResponse update(UUID id, UpdateMappingRequest request) {
        CapabilityConceptMappingEntity entity = findById(id);
        if (request.getMappingType() != null) {
            validateMappingType(request.getMappingType());
            entity.setMappingType(request.getMappingType());
        }
        if (request.getConceptCode() != null) {
            entity.setConceptCode(request.getConceptCode());
        }
        if (request.getMetadata() != null) {
            validateJson(request.getMetadata(), "metadata");
            entity.setMetadata(normalizeJson(request.getMetadata(), "{}"));
        }
        entity.setUpdatedAt(Instant.now());
        CapabilityConceptMappingEntity saved = mappingRepository.save(entity);
        return toResponse(saved);
    }

    @Transactional
    public void delete(UUID id) {
        CapabilityConceptMappingEntity entity = findById(id);
        Instant now = Instant.now();
        entity.setDeletedAt(now);
        entity.setUpdatedAt(now);
        mappingRepository.save(entity);
    }

    @Transactional(readOnly = true)
    public List<MappingResponse> getConceptsForCapability(UUID capabilityId) {
        String tenantId = TenantContext.getOrDefault();
        capabilityService.findById(capabilityId);
        return mappingRepository.findByTenantIdAndCapabilityIdAndDeletedAtIsNull(tenantId, capabilityId)
                .stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public List<MappingResponse> getCapabilitiesForConcept(String conceptId) {
        String tenantId = TenantContext.getOrDefault();
        return mappingRepository.findByTenantIdAndConceptIdAndDeletedAtIsNull(tenantId, conceptId)
                .stream().map(this::toResponse).toList();
    }

    private CapabilityConceptMappingEntity findById(UUID id) {
        String tenantId = TenantContext.getOrDefault();
        return mappingRepository.findByIdAndTenantIdAndDeletedAtIsNull(id, tenantId)
                .orElseThrow(() -> new EaException(ErrorCode.MAPPING_NOT_FOUND, "能力概念映射不存在"));
    }

    private void validateMappingType(String mappingType) {
        if (!TYPE_DIRECT.equals(mappingType) && !TYPE_DERIVED.equals(mappingType) && !TYPE_ABSTRACT.equals(mappingType)) {
            throw new EaException(ErrorCode.INVALID_PARAM, "mappingType 必须为 DIRECT、DERIVED 或 ABSTRACT");
        }
    }

    private void validateJson(String value, String field) {
        if (value == null || value.isBlank()) {
            return;
        }
        try {
            objectMapper.readTree(value);
        } catch (Exception e) {
            throw new EaException(ErrorCode.INVALID_PARAM, field + " 不是合法的 JSON");
        }
    }

    private String normalizeJson(String value, String defaultValue) {
        if (value == null || value.isBlank()) {
            return defaultValue;
        }
        return value;
    }

    private MappingResponse toResponse(CapabilityConceptMappingEntity entity) {
        return MappingResponse.builder()
                .id(entity.getId())
                .capabilityId(entity.getCapabilityId())
                .conceptId(entity.getConceptId())
                .conceptCode(entity.getConceptCode())
                .mappingType(entity.getMappingType())
                .metadata(entity.getMetadata())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }

    public static class OntConceptSnapshot {
        private String conceptId;
        private String conceptCode;
        private String capabilityId;

        public String getConceptId() { return conceptId; }
        public void setConceptId(String conceptId) { this.conceptId = conceptId; }
        public String getConceptCode() { return conceptCode; }
        public void setConceptCode(String conceptCode) { this.conceptCode = conceptCode; }
        public String getCapabilityId() { return capabilityId; }
        public void setCapabilityId(String capabilityId) { this.capabilityId = capabilityId; }
    }
}
