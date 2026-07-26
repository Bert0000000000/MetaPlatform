package com.metaplatform.ont.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.ont.common.ErrorCode;
import com.metaplatform.ont.common.OntStatus;
import com.metaplatform.ont.common.TenantContext;
import com.metaplatform.ont.dto.*;
import com.metaplatform.ont.entity.AttributeEntity;
import com.metaplatform.ont.entity.ConceptAttributeEntity;
import com.metaplatform.ont.entity.ConceptEntity;
import com.metaplatform.ont.entity.EntityAttributeValueEntity;
import com.metaplatform.ont.entity.EntityEntity;
import com.metaplatform.ont.exception.OntException;
import com.metaplatform.ont.repository.AttributeRepository;
import com.metaplatform.ont.repository.ConceptAttributeRepository;
import com.metaplatform.ont.repository.ConceptRepository;
import com.metaplatform.ont.repository.EntityAttributeValueRepository;
import com.metaplatform.ont.repository.EntityRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class EntityService {

    private final EntityRepository entityRepository;
    private final ConceptRepository conceptRepository;
    private final AttributeRepository attributeRepository;
    private final ConceptAttributeRepository conceptAttributeRepository;
    private final EntityAttributeValueRepository valueRepository;
    private final ObjectMapper objectMapper;
    private final OntSyncService ontSyncService;

    @Transactional
    public EntityResponse create(EntityCreateRequest request) {
        String tenantId = TenantContext.get();
        String conceptId = request.getConceptId();
        ConceptEntity concept = conceptRepository.findById(conceptId)
                .orElseThrow(() -> new OntException(ErrorCode.CONCEPT_NOT_FOUND));
        if (!tenantId.equals(concept.getTenantId())) {
            throw new OntException(ErrorCode.TENANT_MISMATCH);
        }

        if (StringUtils.hasText(request.getCode()) &&
                entityRepository.existsByTenantIdAndConceptIdAndCode(tenantId, conceptId, request.getCode())) {
            throw new OntException(ErrorCode.ENTITY_ALREADY_EXISTS);
        }

        String entityId = UUID.randomUUID().toString();
        EntityEntity entity = EntityEntity.builder()
                .entityId(entityId)
                .tenantId(tenantId)
                .conceptId(conceptId)
                .code(request.getCode())
                .name(request.getName())
                .description(request.getDescription())
                .metadata(toJsonNode(request.getMetadata()))
                .status(OntStatus.ACTIVE)
                .createdBy(TenantContext.getUserId())
                .updatedBy(TenantContext.getUserId())
                .build();
        EntityEntity saved = entityRepository.save(entity);

        Map<String, EntityAttributeValueResponse> attributeValues = new HashMap<>();
        Map<String, AttributeEntity> conceptAttributes = loadConceptAttributes(tenantId, conceptId);

        if (request.getAttributes() != null) {
            for (Map.Entry<String, Object> entry : request.getAttributes().entrySet()) {
                AttributeEntity attr = conceptAttributes.get(entry.getKey());
                if (attr == null) {
                    throw new OntException(ErrorCode.ATTRIBUTE_CONSTRAINT_VIOLATION, "属性不存在: " + entry.getKey());
                }
                JsonNode valueNode = toJsonNode(entry.getValue());
                boolean valid = validateValue(attr, valueNode);
                valueRepository.save(EntityAttributeValueEntity.builder()
                        .tenantId(tenantId)
                        .entityId(saved.getEntityId())
                        .attributeId(attr.getAttributeId())
                        .value(valueNode)
                        .valid(valid)
                        .updatedBy(TenantContext.getUserId())
                        .build());
                attributeValues.put(attr.getCode(), buildValueResponse(attr, valueNode, valid, false));
            }
        }

        for (AttributeEntity attr : conceptAttributes.values()) {
            if (Boolean.TRUE.equals(attr.getRequired()) && !attributeValues.containsKey(attr.getCode())) {
                throw new OntException(ErrorCode.ATTRIBUTE_CONSTRAINT_VIOLATION, "必填属性缺失: " + attr.getCode());
            }
            if (!attributeValues.containsKey(attr.getCode()) && attr.getDefaultValue() != null) {
                valueRepository.save(EntityAttributeValueEntity.builder()
                        .tenantId(tenantId)
                        .entityId(saved.getEntityId())
                        .attributeId(attr.getAttributeId())
                        .value(attr.getDefaultValue())
                        .valid(true)
                        .updatedBy(TenantContext.getUserId())
                        .build());
                attributeValues.put(attr.getCode(), buildValueResponse(attr, attr.getDefaultValue(), true, false));
            }
        }

        ontSyncService.syncEntity(saved.getEntityId());

        return toResponse(saved, attributeValues);
    }

    @Transactional(readOnly = true)
    public PageResponse<EntityResponse> list(String keyword, String conceptId, boolean includeAttributes) {
        String tenantId = TenantContext.get();
        List<EntityEntity> entities;
        if (StringUtils.hasText(conceptId)) {
            entities = entityRepository.findByTenantIdAndConceptId(tenantId, conceptId);
        } else {
            entities = entityRepository.findByTenantId(tenantId);
        }
        List<EntityResponse> items = entities.stream()
                .filter(e -> !StringUtils.hasText(keyword) ||
                        e.getName().toLowerCase().contains(keyword.toLowerCase()) ||
                        (e.getCode() != null && e.getCode().toLowerCase().contains(keyword.toLowerCase())))
                .map(e -> includeAttributes ? toResponse(e, loadValues(e.getEntityId())) : toResponse(e, null))
                .toList();
        return PageResponse.<EntityResponse>builder()
                .items(items)
                .total(items.size())
                .page(1)
                .pageSize(items.size())
                .totalPages(items.isEmpty() ? 0 : 1)
                .build();
    }

    @Transactional(readOnly = true)
    public EntityResponse getById(String entityId) {
        EntityEntity entity = findEntity(entityId);
        return toResponse(entity, loadValues(entity.getEntityId()));
    }

    @Transactional
    public EntityResponse update(String entityId, EntityCreateRequest request) {
        String tenantId = TenantContext.get();
        EntityEntity entity = findEntity(entityId);

        if (StringUtils.hasText(request.getName())) {
            entity.setName(request.getName());
        }
        if (request.getDescription() != null) {
            entity.setDescription(request.getDescription());
        }
        if (request.getCode() != null) {
            entity.setCode(request.getCode());
        }
        if (request.getMetadata() != null) {
            entity.setMetadata(toJsonNode(request.getMetadata()));
        }
        entity.setUpdatedBy(TenantContext.getUserId());

        return toResponse(entityRepository.save(entity), loadValues(entityId));
    }

    @Transactional
    public void delete(String entityId) {
        String tenantId = TenantContext.get();
        EntityEntity entity = findEntity(entityId);
        valueRepository.deleteByTenantIdAndEntityId(tenantId, entityId);
        entityRepository.delete(entity);
    }

    @Transactional
    public BatchEntityCreateResponse batchCreate(BatchEntityCreateRequest request) {
        String tenantId = TenantContext.get();
        String conceptId = request.getConceptId();

        // 1. 验证 conceptId 存在
        ConceptEntity concept = conceptRepository.findById(conceptId)
                .orElseThrow(() -> new OntException(ErrorCode.CONCEPT_NOT_FOUND));
        if (!tenantId.equals(concept.getTenantId())) {
            throw new OntException(ErrorCode.TENANT_MISMATCH);
        }

        // 2. 校验批量大小
        List<BatchEntityItem> items = request.getEntities();
        if (items == null || items.isEmpty()) {
            throw new OntException(ErrorCode.INVALID_PARAM, "实体列表不能为空");
        }
        if (items.size() > 100) {
            throw new OntException(ErrorCode.INVALID_PARAM, "单次最多创建 100 条实体");
        }

        // 3. 批量验证 code 唯一性（批次内 + 数据库）
        Set<String> seenCodes = new HashSet<>();
        for (BatchEntityItem item : items) {
            if (StringUtils.hasText(item.getCode())) {
                if (!seenCodes.add(item.getCode())) {
                    throw new OntException(ErrorCode.ENTITY_ALREADY_EXISTS,
                            "批次内实体编码重复: " + item.getCode());
                }
                if (entityRepository.existsByTenantIdAndConceptIdAndCode(tenantId, conceptId, item.getCode())) {
                    throw new OntException(ErrorCode.ENTITY_ALREADY_EXISTS,
                            "实体编码已存在: " + item.getCode());
                }
            }
        }

        // 4. 逐条复用 create() 逻辑创建（同一事务，全部成功或全部失败）
        List<BatchEntityResult> results = new ArrayList<>();
        for (BatchEntityItem item : items) {
            EntityCreateRequest createRequest = new EntityCreateRequest();
            createRequest.setConceptId(conceptId);
            createRequest.setCode(item.getCode());
            createRequest.setName(item.getName());
            createRequest.setAttributes(item.getAttributeValues());

            EntityResponse response = create(createRequest);
            results.add(BatchEntityResult.builder()
                    .id(response.getEntityId())
                    .code(response.getCode())
                    .success(true)
                    .build());
        }

        return BatchEntityCreateResponse.builder()
                .created(results.size())
                .failed(0)
                .results(results)
                .build();
    }

    @Transactional(readOnly = true)
    public PageResponse<EntityResponse> listByConceptId(String conceptId) {
        return list(null, conceptId, false);
    }

    @Transactional
    public Map<String, Object> setAttributes(String entityId, EntityAttributeBatchUpdateRequest request) {
        String tenantId = TenantContext.get();
        EntityEntity entity = findEntity(entityId);
        Map<String, AttributeEntity> conceptAttributes = loadConceptAttributes(tenantId, entity.getConceptId());
        List<String> updated = new ArrayList<>();
        boolean allValid = true;

        if (request.getAttributes() != null) {
            for (Map.Entry<String, Object> entry : request.getAttributes().entrySet()) {
                AttributeEntity attr = conceptAttributes.get(entry.getKey());
                if (attr == null) {
                    throw new OntException(ErrorCode.ATTRIBUTE_NOT_FOUND, "属性编码不存在: " + entry.getKey());
                }
                JsonNode valueNode = toJsonNode(entry.getValue());
                boolean valid = validateValue(attr, valueNode);
                if (!valid) {
                    allValid = false;
                }
                Optional<EntityAttributeValueEntity> existing = valueRepository
                        .findByTenantIdAndEntityIdAndAttributeId(tenantId, entityId, attr.getAttributeId());
                if (existing.isPresent()) {
                    EntityAttributeValueEntity value = existing.get();
                    value.setValue(valueNode);
                    value.setValid(valid);
                    value.setUpdatedBy(TenantContext.getUserId());
                    valueRepository.save(value);
                } else {
                    valueRepository.save(EntityAttributeValueEntity.builder()
                            .tenantId(tenantId)
                            .entityId(entityId)
                            .attributeId(attr.getAttributeId())
                            .value(valueNode)
                            .valid(valid)
                            .updatedBy(TenantContext.getUserId())
                            .build());
                }
                updated.add(attr.getCode());
            }
        }

        entity.setUpdatedBy(TenantContext.getUserId());
        entityRepository.save(entity);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("entityId", entityId);
        result.put("updated", updated);
        Map<String, Object> validation = new LinkedHashMap<>();
        validation.put("passed", allValid);
        validation.put("errors", List.of());
        result.put("validation", validation);
        result.put("updatedAt", entity.getUpdatedAt());
        return result;
    }

    private EntityEntity findEntity(String entityId) {
        String tenantId = TenantContext.get();
        EntityEntity entity = entityRepository.findById(entityId)
                .orElseThrow(() -> new OntException(ErrorCode.ENTITY_NOT_FOUND));
        if (!tenantId.equals(entity.getTenantId())) {
            throw new OntException(ErrorCode.TENANT_MISMATCH);
        }
        return entity;
    }

    private Map<String, AttributeEntity> loadConceptAttributes(String tenantId, String conceptId) {
        List<ConceptAttributeEntity> associations = conceptAttributeRepository.findByTenantIdAndConceptId(tenantId, conceptId);
        Map<String, AttributeEntity> result = new HashMap<>();
        for (ConceptAttributeEntity association : associations) {
            attributeRepository.findById(association.getAttributeId()).ifPresent(attr ->
                    result.put(attr.getCode(), attr));
        }
        return result;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getEntityAttributes(String entityId) {
        String tenantId = TenantContext.get();
        EntityEntity entity = findEntity(entityId);
        Map<String, EntityAttributeValueResponse> values = loadValues(entityId);
        return Map.of(
                "entityId", entity.getEntityId(),
                "attributes", values
        );
    }

    @Transactional
    public Map<String, Object> setSingleAttribute(String entityId, String attributeId, Object value) {
        String tenantId = TenantContext.get();
        EntityEntity entity = findEntity(entityId);
        AttributeEntity attr = attributeRepository.findById(attributeId)
                .orElseThrow(() -> new OntException(ErrorCode.ATTRIBUTE_NOT_FOUND, "属性不存在: " + attributeId));
        if (!tenantId.equals(attr.getTenantId())) {
            throw new OntException(ErrorCode.TENANT_MISMATCH);
        }

        // 校验属性是否关联到该实体的概念上
        boolean associated = conceptAttributeRepository.existsByTenantIdAndConceptIdAndAttributeId(
                tenantId, entity.getConceptId(), attributeId);
        if (!associated) {
            throw new OntException(ErrorCode.ATTRIBUTE_CONSTRAINT_VIOLATION,
                    "属性未关联到该实体的概念");
        }

        JsonNode valueNode = toJsonNode(value);
        boolean valid = validateValue(attr, valueNode);
        Optional<EntityAttributeValueEntity> existing = valueRepository
                .findByTenantIdAndEntityIdAndAttributeId(tenantId, entityId, attributeId);
        if (existing.isPresent()) {
            EntityAttributeValueEntity v = existing.get();
            v.setValue(valueNode);
            v.setValid(valid);
            v.setUpdatedBy(TenantContext.getUserId());
            valueRepository.save(v);
        } else {
            valueRepository.save(EntityAttributeValueEntity.builder()
                    .tenantId(tenantId)
                    .entityId(entityId)
                    .attributeId(attributeId)
                    .value(valueNode)
                    .valid(valid)
                    .updatedBy(TenantContext.getUserId())
                    .build());
        }
        return Map.of(
                "entityId", entityId,
                "attributeId", attributeId,
                "attributeCode", attr.getCode(),
                "value", toObject(valueNode),
                "valid", valid,
                "updatedAt", entity.getUpdatedAt()
        );
    }

    @Transactional
    public Map<String, Object> batchSetAttributes(String entityId, List<EntityAttributeSetRequest> items) {
        String tenantId = TenantContext.get();
        EntityEntity entity = findEntity(entityId);
        List<String> updatedAttributeCodes = new ArrayList<>();
        List<String> errors = new ArrayList<>();
        if (items != null) {
            for (EntityAttributeSetRequest item : items) {
                if (item == null || item.getValue() == null || item.getAttributeId() == null) {
                    errors.add("属性值为空或缺少 attributeId");
                    continue;
                }
                Optional<AttributeEntity> attrOpt = attributeRepository.findById(item.getAttributeId());
                if (attrOpt.isEmpty()) {
                    errors.add("属性不存在: " + item.getAttributeId());
                    continue;
                }
                AttributeEntity attr = attrOpt.get();
                if (!tenantId.equals(attr.getTenantId())) {
                    errors.add("属性租户不匹配");
                    continue;
                }
                boolean associated = conceptAttributeRepository.existsByTenantIdAndConceptIdAndAttributeId(
                        tenantId, entity.getConceptId(), attr.getAttributeId());
                if (!associated) {
                    errors.add("属性未关联到概念: " + attr.getCode());
                    continue;
                }
                JsonNode valueNode = toJsonNode(item.getValue());
                boolean valid = validateValue(attr, valueNode);
                Optional<EntityAttributeValueEntity> existing = valueRepository
                        .findByTenantIdAndEntityIdAndAttributeId(tenantId, entityId, attr.getAttributeId());
                if (existing.isPresent()) {
                    EntityAttributeValueEntity v = existing.get();
                    v.setValue(valueNode);
                    v.setValid(valid);
                    v.setUpdatedBy(TenantContext.getUserId());
                    valueRepository.save(v);
                } else {
                    valueRepository.save(EntityAttributeValueEntity.builder()
                            .tenantId(tenantId)
                            .entityId(entityId)
                            .attributeId(attr.getAttributeId())
                            .value(valueNode)
                            .valid(valid)
                            .updatedBy(TenantContext.getUserId())
                            .build());
                }
                updatedAttributeCodes.add(attr.getCode());
            }
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("entityId", entityId);
        result.put("updated", updatedAttributeCodes);
        result.put("errors", errors);
        result.put("updatedAt", entity.getUpdatedAt());
        return result;
    }

    @Transactional(readOnly = true)
    public Map<String, EntityAttributeValueResponse> loadValues(String entityId) {
        String tenantId = TenantContext.get();
        List<EntityAttributeValueEntity> values = valueRepository.findByTenantIdAndEntityId(tenantId, entityId);
        Map<String, EntityAttributeValueResponse> result = new HashMap<>();
        for (EntityAttributeValueEntity value : values) {
            attributeRepository.findById(value.getAttributeId()).ifPresent(attr ->
                    result.put(attr.getCode(), buildValueResponse(attr, value.getValue(), value.getValid(), false)));
        }
        return result;
    }

    private EntityResponse toResponse(EntityEntity entity, Map<String, EntityAttributeValueResponse> values) {
        String conceptName = conceptRepository.findById(entity.getConceptId()).map(com.metaplatform.ont.entity.ConceptEntity::getName).orElse(null);
        return EntityResponse.builder()
                .entityId(entity.getEntityId())
                .tenantId(entity.getTenantId())
                .conceptId(entity.getConceptId())
                .conceptName(conceptName)
                .code(entity.getCode())
                .name(entity.getName())
                .description(entity.getDescription())
                .attributes(values)
                .metadata(toMap(entity.getMetadata()))
                .status(entity.getStatus().name())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .createdBy(entity.getCreatedBy())
                .updatedBy(entity.getUpdatedBy())
                .build();
    }

    private EntityAttributeValueResponse buildValueResponse(AttributeEntity attr, JsonNode value, boolean valid, Boolean inherited) {
        return EntityAttributeValueResponse.builder()
                .attributeId(attr.getAttributeId())
                .attributeName(attr.getName())
                .value(toObject(value))
                .dataType(attr.getDataType())
                .valid(valid)
                .inherited(inherited)
                .build();
    }

    private boolean validateValue(AttributeEntity attr, JsonNode valueNode) {
        if (valueNode == null || valueNode.isNull()) {
            return !Boolean.TRUE.equals(attr.getRequired());
        }
        if ("ENUM".equalsIgnoreCase(attr.getDataType()) && attr.getEnumValues() != null && attr.getEnumValues().isArray()) {
            String value = valueNode.asText();
            boolean found = false;
            for (JsonNode item : attr.getEnumValues()) {
                if (item.has("value") && value.equals(item.get("value").asText())) {
                    found = true;
                    break;
                }
            }
            return found;
        }
        return true;
    }

    private JsonNode toJsonNode(Object value) {
        if (value == null) {
            return null;
        }
        return objectMapper.valueToTree(value);
    }

    private Object toObject(JsonNode jsonNode) {
        if (jsonNode == null) {
            return null;
        }
        return objectMapper.convertValue(jsonNode, Object.class);
    }

    private Map<String, Object> toMap(JsonNode jsonNode) {
        if (jsonNode == null) {
            return null;
        }
        return objectMapper.convertValue(jsonNode, Map.class);
    }
}
