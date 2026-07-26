package com.metaplatform.ont.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.ont.common.ErrorCode;
import com.metaplatform.ont.common.OntStatus;
import com.metaplatform.ont.common.TenantContext;
import com.metaplatform.ont.dto.PageResponse;
import com.metaplatform.ont.dto.RelationInstanceCreateRequest;
import com.metaplatform.ont.dto.RelationInstanceResponse;
import com.metaplatform.ont.entity.EntityEntity;
import com.metaplatform.ont.entity.RelationInstanceEntity;
import com.metaplatform.ont.entity.RelationTypeEntity;
import com.metaplatform.ont.exception.OntException;
import com.metaplatform.ont.repository.EntityRepository;
import com.metaplatform.ont.repository.RelationInstanceRepository;
import com.metaplatform.ont.repository.RelationTypeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class RelationInstanceService {

    private final RelationInstanceRepository relationInstanceRepository;
    private final RelationTypeRepository relationTypeRepository;
    private final EntityRepository entityRepository;
    private final ObjectMapper objectMapper;
    private final OntSyncService ontSyncService;

    @Transactional
    public RelationInstanceResponse create(RelationInstanceCreateRequest request) {
        String tenantId = TenantContext.get();

        RelationTypeEntity type = relationTypeRepository.findById(request.getRelationTypeId())
                .orElseThrow(() -> new OntException(ErrorCode.RELATION_NOT_FOUND, "关系类型不存在"));
        if (!tenantId.equals(type.getTenantId())) {
            throw new OntException(ErrorCode.TENANT_MISMATCH);
        }

        EntityEntity source = entityRepository.findById(request.getSourceEntityId())
                .orElseThrow(() -> new OntException(ErrorCode.ENTITY_NOT_FOUND, "源实体不存在"));
        EntityEntity target = entityRepository.findById(request.getTargetEntityId())
                .orElseThrow(() -> new OntException(ErrorCode.ENTITY_NOT_FOUND, "目标实体不存在"));
        if (!tenantId.equals(source.getTenantId()) || !tenantId.equals(target.getTenantId())) {
            throw new OntException(ErrorCode.TENANT_MISMATCH);
        }

        // 实体概念必须与关系类型所定义的概念相匹配（source 必须属于 sourceConceptId 同概念树，target 同理）
        if (!matchesConceptOrDescendant(source.getConceptId(), type.getSourceConceptId(), tenantId)) {
            throw new OntException(ErrorCode.RELATION_CONSTRAINT_VIOLATION,
                    "源实体概念与关系类型源概念不匹配");
        }
        if (!matchesConceptOrDescendant(target.getConceptId(), type.getTargetConceptId(), tenantId)) {
            throw new OntException(ErrorCode.RELATION_CONSTRAINT_VIOLATION,
                    "目标实体概念与关系类型目标概念不匹配");
        }

        // 唯一性：同一租户内同一关系类型 source→target 不允许重复
        if (relationInstanceRepository.findByTenantIdAndRelationTypeIdAndSourceEntityIdAndTargetEntityId(
                tenantId, request.getRelationTypeId(),
                request.getSourceEntityId(), request.getTargetEntityId()).isPresent()) {
            throw new OntException(ErrorCode.RELATION_ALREADY_EXISTS, "相同关系实例已存在");
        }

        // 基数校验
        validateCardinality(type, request.getSourceEntityId(), request.getTargetEntityId());

        RelationInstanceEntity entity = RelationInstanceEntity.builder()
                .relationInstanceId(UUID.randomUUID().toString())
                .tenantId(tenantId)
                .relationTypeId(request.getRelationTypeId())
                .sourceEntityId(request.getSourceEntityId())
                .targetEntityId(request.getTargetEntityId())
                .attributes(toJsonNode(request.getAttributes()))
                .metadata(toJsonNode(request.getMetadata()))
                .status(OntStatus.ACTIVE)
                .createdBy(TenantContext.getUserId())
                .updatedBy(TenantContext.getUserId())
                .build();

        RelationInstanceEntity saved = relationInstanceRepository.save(entity);

        ontSyncService.syncRelation(saved.getRelationInstanceId());

        return toResponse(saved, type, source, target);
    }

    @Transactional(readOnly = true)
    public PageResponse<RelationInstanceResponse> list(String relationTypeId,
                                                       String sourceEntityId,
                                                       String targetEntityId) {
        String tenantId = TenantContext.get();
        List<RelationInstanceEntity> entities;
        if (StringUtils.hasText(relationTypeId) && StringUtils.hasText(sourceEntityId)) {
            entities = relationInstanceRepository.findByTenantIdAndRelationTypeIdAndSourceEntityId(
                    tenantId, relationTypeId, sourceEntityId);
        } else if (StringUtils.hasText(relationTypeId) && StringUtils.hasText(targetEntityId)) {
            entities = relationInstanceRepository.findByTenantIdAndRelationTypeIdAndTargetEntityId(
                    tenantId, relationTypeId, targetEntityId);
        } else if (StringUtils.hasText(relationTypeId)) {
            entities = relationInstanceRepository.findByTenantIdAndRelationTypeId(tenantId, relationTypeId);
        } else if (StringUtils.hasText(sourceEntityId)) {
            entities = relationInstanceRepository.findByTenantIdAndSourceEntityId(tenantId, sourceEntityId);
        } else if (StringUtils.hasText(targetEntityId)) {
            entities = relationInstanceRepository.findByTenantIdAndTargetEntityId(tenantId, targetEntityId);
        } else {
            entities = relationInstanceRepository.findByTenantId(tenantId);
        }

        List<RelationInstanceResponse> items = entities.stream()
                .map(this::toResponseSafely)
                .toList();

        return PageResponse.<RelationInstanceResponse>builder()
                .items(items)
                .total(items.size())
                .page(1)
                .pageSize(items.size())
                .totalPages(items.isEmpty() ? 0 : 1)
                .build();
    }

    @Transactional(readOnly = true)
    public RelationInstanceResponse getById(String relationInstanceId) {
        RelationInstanceEntity entity = findInstance(relationInstanceId);
        return toResponseSafely(entity);
    }

    @Transactional
    public void delete(String relationInstanceId) {
        RelationInstanceEntity entity = findInstance(relationInstanceId);
        relationInstanceRepository.delete(entity);

        ontSyncService.syncRelation(relationInstanceId);
    }

    /**
     * 实体概念属于 relationConcept 的概念子树（自身或子孙）。
     * 用于关系类型 source/target 的概念匹配。
     * 当前 Phase 2 简化实现：实体概念直接匹配关系概念；后续 Sprint 支持父子概念传递匹配。
     */
    private boolean matchesConceptOrDescendant(String entityConceptId, String relationConceptId, String tenantId) {
        return entityConceptId != null && entityConceptId.equals(relationConceptId);
    }

    private void validateCardinality(RelationTypeEntity type,
                                     String sourceEntityId,
                                     String targetEntityId) {
        int max = type.getMaxCardinality() == null ? 0 : type.getMaxCardinality();
        if (max <= 0) {
            return; // 无限制
        }
        String cardinality = type.getCardinality() == null ? "" : type.getCardinality().toUpperCase();
        long current = switch (cardinality) {
            case "ONE_TO_ONE", "ONE_TO_MANY" ->
                    relationInstanceRepository.countByTenantIdAndRelationTypeIdAndSourceEntityId(
                            type.getTenantId(), type.getRelationTypeId(), sourceEntityId);
            case "MANY_TO_ONE" ->
                    relationInstanceRepository.findByTenantIdAndRelationTypeId(
                                    type.getTenantId(), type.getRelationTypeId()).stream()
                            .filter(i -> i.getTargetEntityId().equals(targetEntityId))
                            .count();
            default -> 0L;
        };
        if (current >= max) {
            throw new OntException(ErrorCode.RELATION_CONSTRAINT_VIOLATION,
                    "违反基数约束: 当前 " + current + "，上限 " + max);
        }
    }

    private RelationInstanceEntity findInstance(String relationInstanceId) {
        String tenantId = TenantContext.get();
        RelationInstanceEntity entity = relationInstanceRepository.findById(relationInstanceId)
                .orElseThrow(() -> new OntException(ErrorCode.RELATION_NOT_FOUND, "关系实例不存在"));
        if (!tenantId.equals(entity.getTenantId())) {
            throw new OntException(ErrorCode.TENANT_MISMATCH);
        }
        return entity;
    }

    private RelationInstanceResponse toResponseSafely(RelationInstanceEntity entity) {
        RelationTypeEntity type = relationTypeRepository.findById(entity.getRelationTypeId()).orElse(null);
        EntityEntity source = entityRepository.findById(entity.getSourceEntityId()).orElse(null);
        EntityEntity target = entityRepository.findById(entity.getTargetEntityId()).orElse(null);
        return toResponse(entity, type, source, target);
    }

    private RelationInstanceResponse toResponse(RelationInstanceEntity entity,
                                                RelationTypeEntity type,
                                                EntityEntity source,
                                                EntityEntity target) {
        return RelationInstanceResponse.builder()
                .relationInstanceId(entity.getRelationInstanceId())
                .tenantId(entity.getTenantId())
                .relationTypeId(entity.getRelationTypeId())
                .relationTypeCode(type != null ? type.getCode() : null)
                .sourceEntityId(entity.getSourceEntityId())
                .sourceEntityName(source != null ? source.getName() : null)
                .targetEntityId(entity.getTargetEntityId())
                .targetEntityName(target != null ? target.getName() : null)
                .attributes(toObjectMap(entity.getAttributes()))
                .metadata(toObjectMap(entity.getMetadata()))
                .status(entity.getStatus() != null ? entity.getStatus().name() : null)
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

    @SuppressWarnings("unchecked")
    private java.util.Map<String, Object> toObjectMap(JsonNode node) {
        if (node == null || node.isNull()) {
            return null;
        }
        return objectMapper.convertValue(node, java.util.Map.class);
    }
}