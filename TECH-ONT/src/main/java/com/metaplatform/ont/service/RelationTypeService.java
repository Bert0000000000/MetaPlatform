package com.metaplatform.ont.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.ont.common.ErrorCode;
import com.metaplatform.ont.common.TenantContext;
import com.metaplatform.ont.dto.PageResponse;
import com.metaplatform.ont.dto.RelationTypeCreateRequest;
import com.metaplatform.ont.dto.RelationTypeResponse;
import com.metaplatform.ont.dto.RelationTypeUpdateRequest;
import com.metaplatform.ont.entity.ConceptEntity;
import com.metaplatform.ont.entity.RelationInstanceEntity;
import com.metaplatform.ont.entity.RelationTypeEntity;
import com.metaplatform.ont.exception.OntException;
import com.metaplatform.ont.repository.ConceptRepository;
import com.metaplatform.ont.repository.RelationInstanceRepository;
import com.metaplatform.ont.repository.RelationTypeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.CollectionUtils;
import org.springframework.util.StringUtils;

import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class RelationTypeService {

    private static final Set<String> ALLOWED_CARDINALITIES = Set.of(
            "ONE_TO_ONE", "ONE_TO_MANY", "MANY_TO_ONE", "MANY_TO_MANY");
    private static final Set<String> ALLOWED_DIRECTIONS = Set.of(
            "DIRECTED", "UNDIRECTED", "BIDIRECTIONAL");

    private final RelationTypeRepository relationTypeRepository;
    private final RelationInstanceRepository relationInstanceRepository;
    private final ConceptRepository conceptRepository;
    private final ObjectMapper objectMapper;

    @Transactional
    public RelationTypeResponse create(RelationTypeCreateRequest request) {
        String tenantId = TenantContext.get();

        validateCardinality(request.getCardinality());
        validateDirection(request.getDirection());
        validateCardinalityBounds(request.getMinCardinality(), request.getMaxCardinality());

        if (relationTypeRepository.existsByTenantIdAndCode(tenantId, request.getCode())) {
            throw new OntException(ErrorCode.RELATION_ALREADY_EXISTS, "关系类型编码已存在");
        }

        ConceptEntity source = loadConcept(request.getSourceConceptId());
        ConceptEntity target = loadConcept(request.getTargetConceptId());

        if (!tenantId.equals(source.getTenantId()) || !tenantId.equals(target.getTenantId())) {
            throw new OntException(ErrorCode.TENANT_MISMATCH);
        }

        RelationTypeEntity entity = RelationTypeEntity.builder()
                .relationTypeId(UUID.randomUUID().toString())
                .tenantId(tenantId)
                .code(request.getCode())
                .name(request.getName())
                .description(request.getDescription())
                .sourceConceptId(request.getSourceConceptId())
                .targetConceptId(request.getTargetConceptId())
                .direction(StringUtils.hasText(request.getDirection()) ? request.getDirection() : "DIRECTED")
                .cardinality(StringUtils.hasText(request.getCardinality()) ? request.getCardinality() : "MANY_TO_MANY")
                .minCardinality(request.getMinCardinality() != null ? request.getMinCardinality() : 0)
                .maxCardinality(request.getMaxCardinality() != null ? request.getMaxCardinality() : 0)
                .symmetric(Boolean.TRUE.equals(request.getSymmetric()))
                .transitive(Boolean.TRUE.equals(request.getTransitive()))
                .attributeIds(toJsonNode(request.getAttributeIds()))
                .createdBy(TenantContext.getUserId())
                .updatedBy(TenantContext.getUserId())
                .build();

        RelationTypeEntity saved = relationTypeRepository.save(entity);
        return toResponse(saved, source.getName(), target.getName(), 0L);
    }

    @Transactional(readOnly = true)
    public PageResponse<RelationTypeResponse> list(String keyword,
                                                   String sourceConceptId,
                                                   String targetConceptId,
                                                   String direction) {
        String tenantId = TenantContext.get();
        List<RelationTypeEntity> entities;
        if (StringUtils.hasText(sourceConceptId)) {
            entities = relationTypeRepository.findByTenantIdAndSourceConceptId(tenantId, sourceConceptId);
        } else if (StringUtils.hasText(targetConceptId)) {
            entities = relationTypeRepository.findByTenantIdAndTargetConceptId(tenantId, targetConceptId);
        } else if (StringUtils.hasText(direction)) {
            entities = relationTypeRepository.findByTenantIdAndDirection(tenantId, direction);
        } else {
            entities = relationTypeRepository.findByTenantId(tenantId);
        }

        List<RelationTypeResponse> items = entities.stream()
                .filter(rt -> !StringUtils.hasText(keyword)
                        || rt.getName().toLowerCase().contains(keyword.toLowerCase())
                        || rt.getCode().toLowerCase().contains(keyword.toLowerCase()))
                .map(this::toListResponse)
                .toList();

        return PageResponse.<RelationTypeResponse>builder()
                .items(items)
                .total(items.size())
                .page(1)
                .pageSize(items.size())
                .totalPages(items.isEmpty() ? 0 : 1)
                .build();
    }

    @Transactional(readOnly = true)
    public RelationTypeResponse getById(String relationTypeId) {
        RelationTypeEntity entity = findRelationType(relationTypeId);
        long instanceCount = relationInstanceRepository.countByTenantIdAndRelationTypeId(
                entity.getTenantId(), relationTypeId);
        return toResponse(entity, sourceName(entity), targetName(entity), instanceCount);
    }

    @Transactional
    public RelationTypeResponse update(String relationTypeId, RelationTypeUpdateRequest request) {
        RelationTypeEntity entity = findRelationType(relationTypeId);

        if (StringUtils.hasText(request.getCardinality())) {
            validateCardinality(request.getCardinality());
            entity.setCardinality(request.getCardinality());
        }
        if (StringUtils.hasText(request.getDirection())) {
            validateDirection(request.getDirection());
            entity.setDirection(request.getDirection());
        }
        if (request.getMinCardinality() != null || request.getMaxCardinality() != null) {
            int min = request.getMinCardinality() != null ? request.getMinCardinality() : entity.getMinCardinality();
            int max = request.getMaxCardinality() != null ? request.getMaxCardinality() : entity.getMaxCardinality();
            validateCardinalityBounds(min, max);
            entity.setMinCardinality(min);
            entity.setMaxCardinality(max);
        }
        if (StringUtils.hasText(request.getName())) {
            entity.setName(request.getName());
        }
        if (request.getDescription() != null) {
            entity.setDescription(request.getDescription());
        }
        if (request.getSymmetric() != null) {
            entity.setSymmetric(request.getSymmetric());
        }
        if (request.getTransitive() != null) {
            entity.setTransitive(request.getTransitive());
        }
        if (request.getAttributeIds() != null) {
            entity.setAttributeIds(toJsonNode(request.getAttributeIds()));
        }
        entity.setUpdatedBy(TenantContext.getUserId());

        RelationTypeEntity saved = relationTypeRepository.save(entity);
        long instanceCount = relationInstanceRepository.countByTenantIdAndRelationTypeId(
                saved.getTenantId(), relationTypeId);
        return toResponse(saved, sourceName(saved), targetName(saved), instanceCount);
    }

    @Transactional
    public long delete(String relationTypeId, boolean cascade) {
        RelationTypeEntity entity = findRelationType(relationTypeId);
        long count = relationInstanceRepository.countByTenantIdAndRelationTypeId(
                entity.getTenantId(), relationTypeId);
        if (count > 0 && !cascade) {
            throw new OntException(ErrorCode.RELATION_CONSTRAINT_VIOLATION,
                    "存在关系实例且未开启级联删除");
        }
        if (count > 0) {
            relationInstanceRepository.deleteByTenantIdAndRelationTypeId(entity.getTenantId(), relationTypeId);
        }
        relationTypeRepository.delete(entity);
        return count;
    }

    private RelationTypeEntity findRelationType(String relationTypeId) {
        String tenantId = TenantContext.get();
        RelationTypeEntity entity = relationTypeRepository.findById(relationTypeId)
                .orElseThrow(() -> new OntException(ErrorCode.RELATION_NOT_FOUND));
        if (!tenantId.equals(entity.getTenantId())) {
            throw new OntException(ErrorCode.TENANT_MISMATCH);
        }
        return entity;
    }

    private ConceptEntity loadConcept(String conceptId) {
        return conceptRepository.findById(conceptId)
                .orElseThrow(() -> new OntException(ErrorCode.CONCEPT_NOT_FOUND));
    }

    private void validateCardinality(String cardinality) {
        if (StringUtils.hasText(cardinality) && !ALLOWED_CARDINALITIES.contains(cardinality.toUpperCase())) {
            throw new OntException(ErrorCode.INVALID_FIELD_VALUE, "非法的基数: " + cardinality);
        }
    }

    private void validateDirection(String direction) {
        if (StringUtils.hasText(direction) && !ALLOWED_DIRECTIONS.contains(direction.toUpperCase())) {
            throw new OntException(ErrorCode.INVALID_FIELD_VALUE, "非法的方向: " + direction);
        }
    }

    private void validateCardinalityBounds(Integer min, Integer max) {
        int minValue = min == null ? 0 : min;
        int maxValue = max == null ? 0 : max;
        if (minValue < 0 || maxValue < 0) {
            throw new OntException(ErrorCode.INVALID_FIELD_VALUE, "基数必须为非负整数");
        }
        if (maxValue > 0 && minValue > maxValue) {
            throw new OntException(ErrorCode.INVALID_FIELD_VALUE, "最小基数不能大于最大基数");
        }
    }

    private String sourceName(RelationTypeEntity entity) {
        return conceptRepository.findById(entity.getSourceConceptId())
                .map(ConceptEntity::getName).orElse(null);
    }

    private String targetName(RelationTypeEntity entity) {
        return conceptRepository.findById(entity.getTargetConceptId())
                .map(ConceptEntity::getName).orElse(null);
    }

    private RelationTypeResponse toListResponse(RelationTypeEntity entity) {
        long count = relationInstanceRepository.countByTenantIdAndRelationTypeId(
                entity.getTenantId(), entity.getRelationTypeId());
        return toResponse(entity, sourceName(entity), targetName(entity), count);
    }

    private RelationTypeResponse toResponse(RelationTypeEntity entity,
                                            String sourceName,
                                            String targetName,
                                            long instanceCount) {
        List<String> attributeIds = null;
        if (entity.getAttributeIds() != null && entity.getAttributeIds().isArray()) {
            attributeIds = entity.getAttributeIds().findValuesAsText("").stream()
                    .filter(s -> !s.isEmpty()).collect(Collectors.toList());
        }
        return RelationTypeResponse.builder()
                .relationTypeId(entity.getRelationTypeId())
                .tenantId(entity.getTenantId())
                .code(entity.getCode())
                .name(entity.getName())
                .description(entity.getDescription())
                .sourceConceptId(entity.getSourceConceptId())
                .sourceConceptName(sourceName)
                .targetConceptId(entity.getTargetConceptId())
                .targetConceptName(targetName)
                .direction(entity.getDirection())
                .cardinality(entity.getCardinality())
                .minCardinality(entity.getMinCardinality())
                .maxCardinality(entity.getMaxCardinality())
                .symmetric(entity.getSymmetric())
                .transitive(entity.getTransitive())
                .attributeIds(CollectionUtils.isEmpty(attributeIds) ? null : attributeIds)
                .instanceCount(instanceCount)
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .createdBy(entity.getCreatedBy())
                .updatedBy(entity.getUpdatedBy())
                .build();
    }

    private JsonNode toJsonNode(Object value) {
        if (value == null) {
            return null;
        }
        return objectMapper.valueToTree(value);
    }
}