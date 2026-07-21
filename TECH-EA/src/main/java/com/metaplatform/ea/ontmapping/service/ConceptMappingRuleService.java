package com.metaplatform.ea.ontmapping.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.ea.common.ErrorCode;
import com.metaplatform.ea.common.TenantContext;
import com.metaplatform.ea.exception.EaException;
import com.metaplatform.ea.mapping.service.OntIntegrationService;
import com.metaplatform.ea.ontmapping.dto.*;
import com.metaplatform.ea.ontmapping.entity.ConceptMappingRuleEntity;
import com.metaplatform.ea.ontmapping.repository.ConceptMappingRuleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ConceptMappingRuleService {

    private static final String TYPE_DIRECT = "DIRECT";
    private static final String TYPE_DERIVED = "DERIVED";
    private static final String TYPE_ABSTRACT = "ABSTRACT";

    private final ConceptMappingRuleRepository ruleRepository;
    private final OntIntegrationService ontIntegrationService;
    private final ObjectMapper objectMapper;

    @Transactional
    public ConceptMappingRuleResponse create(CreateConceptMappingRuleRequest request) {
        String tenantId = TenantContext.getOrDefault();
        validateMappingType(request.getMappingType());
        validateJson(request.getMetadata(), "metadata");
        ontIntegrationService.validateConceptExists(request.getConceptId());

        if (ruleRepository.existsByTenantIdAndAssetTypeAndAssetIdAndConceptIdAndDeletedAtIsNull(
                tenantId, request.getAssetType().toUpperCase(), request.getAssetId(), request.getConceptId())) {
            throw new EaException(ErrorCode.ALREADY_EXISTS, "该架构资产已映射到此 Ontology 概念");
        }

        Instant now = Instant.now();
        ConceptMappingRuleEntity entity = ConceptMappingRuleEntity.builder()
                .tenantId(tenantId)
                .assetType(request.getAssetType().toUpperCase())
                .assetId(request.getAssetId())
                .assetName(request.getAssetName())
                .conceptId(request.getConceptId())
                .conceptCode(request.getConceptCode())
                .mappingType(request.getMappingType().toUpperCase())
                .description(request.getDescription())
                .metadata(normalizeJson(request.getMetadata(), "{}"))
                .createdAt(now)
                .updatedAt(now)
                .build();
        return toResponse(ruleRepository.save(entity));
    }

    @Transactional(readOnly = true)
    public List<ConceptMappingRuleResponse> list(String assetType) {
        String tenantId = TenantContext.getOrDefault();
        List<ConceptMappingRuleEntity> entities;
        if (StringUtils.hasText(assetType)) {
            entities = ruleRepository.findByTenantIdAndAssetTypeAndDeletedAtIsNull(tenantId, assetType.toUpperCase());
        } else {
            entities = ruleRepository.findByTenantIdAndDeletedAtIsNull(tenantId);
        }
        return entities.stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public ConceptMappingRuleResponse get(UUID id) {
        return toResponse(findById(id));
    }

    @Transactional
    public ConceptMappingRuleResponse update(UUID id, UpdateConceptMappingRuleRequest request) {
        ConceptMappingRuleEntity entity = findById(id);
        if (StringUtils.hasText(request.getAssetType())) {
            entity.setAssetType(request.getAssetType().toUpperCase());
        }
        if (StringUtils.hasText(request.getConceptId())) {
            ontIntegrationService.validateConceptExists(request.getConceptId());
            entity.setConceptId(request.getConceptId());
        }
        if (request.getConceptCode() != null) {
            entity.setConceptCode(request.getConceptCode());
        }
        if (StringUtils.hasText(request.getMappingType())) {
            validateMappingType(request.getMappingType());
            entity.setMappingType(request.getMappingType().toUpperCase());
        }
        if (request.getDescription() != null) {
            entity.setDescription(request.getDescription());
        }
        if (request.getMetadata() != null) {
            validateJson(request.getMetadata(), "metadata");
            entity.setMetadata(normalizeJson(request.getMetadata(), "{}"));
        }
        entity.setUpdatedAt(Instant.now());
        return toResponse(ruleRepository.save(entity));
    }

    @Transactional
    public void delete(UUID id) {
        ConceptMappingRuleEntity entity = findById(id);
        Instant now = Instant.now();
        entity.setDeletedAt(now);
        entity.setUpdatedAt(now);
        ruleRepository.save(entity);
    }

    @Transactional(readOnly = true)
    public List<ConceptMappingRuleResponse> findByConceptId(String conceptId) {
        String tenantId = TenantContext.getOrDefault();
        return ruleRepository.findByTenantIdAndConceptIdAndDeletedAtIsNull(tenantId, conceptId)
                .stream().map(this::toResponse).toList();
    }

    private ConceptMappingRuleEntity findById(UUID id) {
        String tenantId = TenantContext.getOrDefault();
        return ruleRepository.findByIdAndTenantIdAndDeletedAtIsNull(id, tenantId)
                .orElseThrow(() -> new EaException(ErrorCode.NOT_FOUND, "Ontology 映射规则不存在"));
    }

    private void validateMappingType(String mappingType) {
        String upper = mappingType.toUpperCase();
        if (!TYPE_DIRECT.equals(upper) && !TYPE_DERIVED.equals(upper) && !TYPE_ABSTRACT.equals(upper)) {
            throw new EaException(ErrorCode.INVALID_PARAM, "mappingType 必须为 DIRECT、DERIVED 或 ABSTRACT");
        }
    }

    private void validateJson(String value, String field) {
        if (value == null || value.isBlank()) return;
        try {
            objectMapper.readTree(value);
        } catch (Exception e) {
            throw new EaException(ErrorCode.INVALID_PARAM, field + " 不是合法的 JSON");
        }
    }

    private String normalizeJson(String value, String defaultValue) {
        if (value == null || value.isBlank()) return defaultValue;
        return value;
    }

    private ConceptMappingRuleResponse toResponse(ConceptMappingRuleEntity entity) {
        return ConceptMappingRuleResponse.builder()
                .id(entity.getId())
                .tenantId(entity.getTenantId())
                .assetType(entity.getAssetType())
                .assetId(entity.getAssetId())
                .assetName(entity.getAssetName())
                .conceptId(entity.getConceptId())
                .conceptCode(entity.getConceptCode())
                .mappingType(entity.getMappingType())
                .description(entity.getDescription())
                .metadata(entity.getMetadata())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }
}
