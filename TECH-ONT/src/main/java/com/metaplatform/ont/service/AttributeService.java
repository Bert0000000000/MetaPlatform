package com.metaplatform.ont.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.ont.common.ErrorCode;
import com.metaplatform.ont.common.TenantContext;
import com.metaplatform.ont.dto.AttributeCreateRequest;
import com.metaplatform.ont.dto.AttributeResponse;
import com.metaplatform.ont.dto.AttributeUpdateRequest;
import com.metaplatform.ont.dto.PageResponse;
import com.metaplatform.ont.entity.AttributeEntity;
import com.metaplatform.ont.entity.ConceptAttributeEntity;
import com.metaplatform.ont.entity.ConceptEntity;
import com.metaplatform.ont.exception.OntException;
import com.metaplatform.ont.repository.AttributeRepository;
import com.metaplatform.ont.repository.ConceptAttributeRepository;
import com.metaplatform.ont.repository.ConceptRepository;
import com.metaplatform.ont.repository.EntityAttributeValueRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.CollectionUtils;
import org.springframework.util.StringUtils;

import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AttributeService {

    private final AttributeRepository attributeRepository;
    private final ConceptAttributeRepository conceptAttributeRepository;
    private final ConceptRepository conceptRepository;
    private final EntityAttributeValueRepository entityAttributeValueRepository;
    private final ObjectMapper objectMapper;

    @Transactional
    public AttributeResponse create(AttributeCreateRequest request) {
        String tenantId = TenantContext.get();
        if (attributeRepository.existsByTenantIdAndCode(tenantId, request.getCode())) {
            throw new OntException(ErrorCode.ATTRIBUTE_ALREADY_EXISTS);
        }
        if ("ENUM".equalsIgnoreCase(request.getDataType()) && CollectionUtils.isEmpty(request.getEnumValues())) {
            throw new OntException(ErrorCode.INVALID_FIELD_VALUE, "ENUM 类型属性必须提供枚举值");
        }

        AttributeEntity attribute = AttributeEntity.builder()
                .attributeId(UUID.randomUUID().toString())
                .tenantId(tenantId)
                .code(request.getCode())
                .name(request.getName())
                .description(request.getDescription())
                .dataType(request.getDataType())
                .required(request.getRequired() != null ? request.getRequired() : false)
                .unique(request.getUnique() != null ? request.getUnique() : false)
                .defaultValue(toJsonNode(request.getDefaultValue()))
                .enumValues(toJsonNode(request.getEnumValues()))
                .constraints(toJsonNode(request.getConstraints()))
                .unit(request.getUnit())
                .createdBy(TenantContext.getUserId())
                .updatedBy(TenantContext.getUserId())
                .build();

        return toResponse(attributeRepository.save(attribute), true);
    }

    @Transactional(readOnly = true)
    public PageResponse<AttributeResponse> list(String keyword, String dataType, String conceptId) {
        String tenantId = TenantContext.get();
        List<AttributeEntity> attributes = attributeRepository.findByTenantId(tenantId);
        List<AttributeResponse> items = attributes.stream()
                .filter(a -> !StringUtils.hasText(keyword) ||
                        a.getName().toLowerCase().contains(keyword.toLowerCase()) ||
                        a.getCode().toLowerCase().contains(keyword.toLowerCase()))
                .filter(a -> !StringUtils.hasText(dataType) || dataType.equalsIgnoreCase(a.getDataType()))
                .filter(a -> !StringUtils.hasText(conceptId) ||
                        conceptAttributeRepository.existsByTenantIdAndConceptIdAndAttributeId(tenantId, conceptId, a.getAttributeId()))
                .map(a -> toResponse(a, false))
                .toList();
        return PageResponse.<AttributeResponse>builder()
                .items(items)
                .total(items.size())
                .page(1)
                .pageSize(items.size())
                .totalPages(items.isEmpty() ? 0 : 1)
                .build();
    }

    @Transactional(readOnly = true)
    public AttributeResponse getById(String attributeId) {
        AttributeEntity attribute = findAttribute(attributeId);
        return toResponse(attribute, true);
    }

    @Transactional
    public AttributeResponse update(String attributeId, AttributeUpdateRequest request) {
        AttributeEntity attribute = findAttribute(attributeId);

        if (StringUtils.hasText(request.getName())) {
            attribute.setName(request.getName());
        }
        if (request.getDescription() != null) {
            attribute.setDescription(request.getDescription());
        }
        if (request.getRequired() != null) {
            attribute.setRequired(request.getRequired());
        }
        if (request.getUnique() != null) {
            attribute.setUnique(request.getUnique());
        }
        if (request.getDefaultValue() != null) {
            attribute.setDefaultValue(toJsonNode(request.getDefaultValue()));
        }
        if (request.getEnumValues() != null) {
            if ("ENUM".equalsIgnoreCase(attribute.getDataType()) && request.getEnumValues().isEmpty()) {
                throw new OntException(ErrorCode.INVALID_FIELD_VALUE, "ENUM 类型属性必须提供枚举值");
            }
            attribute.setEnumValues(toJsonNode(request.getEnumValues()));
        }
        if (request.getConstraints() != null) {
            attribute.setConstraints(toJsonNode(request.getConstraints()));
        }
        if (request.getUnit() != null) {
            attribute.setUnit(request.getUnit());
        }
        attribute.setUpdatedBy(TenantContext.getUserId());

        return toResponse(attributeRepository.save(attribute), false);
    }

    @Transactional
    public void delete(String attributeId, boolean cascade) {
        String tenantId = TenantContext.get();
        AttributeEntity attribute = findAttribute(attributeId);

        long conceptCount = conceptAttributeRepository.findByTenantIdAndAttributeId(tenantId, attributeId).size();
        if (conceptCount > 0 && !cascade) {
            throw new OntException(ErrorCode.ATTRIBUTE_CONSTRAINT_VIOLATION, "属性已被概念关联");
        }
        if (cascade) {
            conceptAttributeRepository.findByTenantIdAndAttributeId(tenantId, attributeId).forEach(conceptAttributeRepository::delete);
            entityAttributeValueRepository.findByTenantIdAndAttributeId(tenantId, attributeId)
                    .forEach(entityAttributeValueRepository::delete);
        }

        attributeRepository.delete(attribute);
    }

    private AttributeEntity findAttribute(String attributeId) {
        String tenantId = TenantContext.get();
        AttributeEntity attribute = attributeRepository.findById(attributeId)
                .orElseThrow(() -> new OntException(ErrorCode.ATTRIBUTE_NOT_FOUND));
        if (!tenantId.equals(attribute.getTenantId())) {
            throw new OntException(ErrorCode.TENANT_MISMATCH);
        }
        return attribute;
    }

    private AttributeResponse toResponse(AttributeEntity attribute, boolean includeConcepts) {
        List<ConceptAttributeEntity> associations = conceptAttributeRepository.findByTenantIdAndAttributeId(attribute.getTenantId(), attribute.getAttributeId());
        List<AttributeResponse.ConceptRef> concepts = null;
        if (includeConcepts) {
            concepts = associations.stream()
                    .map(a -> conceptRepository.findById(a.getConceptId())
                            .map(c -> AttributeResponse.ConceptRef.builder()
                                    .conceptId(c.getConceptId())
                                    .conceptName(c.getName())
                                    .build())
                            .orElse(null))
                    .filter(Objects::nonNull)
                    .toList();
        }
        return AttributeResponse.builder()
                .attributeId(attribute.getAttributeId())
                .tenantId(attribute.getTenantId())
                .code(attribute.getCode())
                .name(attribute.getName())
                .description(attribute.getDescription())
                .dataType(attribute.getDataType())
                .required(attribute.getRequired())
                .unique(attribute.getUnique())
                .defaultValue(toObject(attribute.getDefaultValue()))
                .enumValues(toListOfMaps(attribute.getEnumValues()))
                .constraints(toMap(attribute.getConstraints()))
                .unit(attribute.getUnit())
                .conceptCount((long) associations.size())
                .concepts(concepts)
                .createdAt(attribute.getCreatedAt())
                .updatedAt(attribute.getUpdatedAt())
                .createdBy(attribute.getCreatedBy())
                .updatedBy(attribute.getUpdatedBy())
                .build();
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

    @SuppressWarnings("unchecked")
    private List<Map<String, String>> toListOfMaps(JsonNode jsonNode) {
        if (jsonNode == null || !jsonNode.isArray()) {
            return null;
        }
        return objectMapper.convertValue(jsonNode, List.class);
    }
}
