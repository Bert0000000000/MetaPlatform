package com.metaplatform.ont.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.ont.common.ErrorCode;
import com.metaplatform.ont.common.TenantContext;
import com.metaplatform.ont.dto.OntologyConceptDto;
import com.metaplatform.ont.entity.AttributeEntity;
import com.metaplatform.ont.entity.ConceptAttributeEntity;
import com.metaplatform.ont.entity.ConceptEntity;
import com.metaplatform.ont.entity.EntityAttributeValueEntity;
import com.metaplatform.ont.entity.EntityEntity;
import com.metaplatform.ont.entity.RelationTypeEntity;
import com.metaplatform.ont.exception.OntException;
import com.metaplatform.ont.repository.AttributeRepository;
import com.metaplatform.ont.repository.ConceptAttributeRepository;
import com.metaplatform.ont.repository.ConceptRepository;
import com.metaplatform.ont.repository.EntityAttributeValueRepository;
import com.metaplatform.ont.repository.EntityRepository;
import com.metaplatform.ont.repository.RelationTypeRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * 本体探索服务（V12-01 REQ-030 / REQ-031）。
 * 提供面向前端的「概念搜索」与「概念详情」能力，对齐 OntologyConcept 类型。
 * <ul>
 *   <li>搜索：按关键字、属性、标签过滤概念；</li>
 *   <li>详情：返回概念的属性定义、实例（前 N 条）、关联概念列表。</li>
 * </ul>
 * 数据源：PostgreSQL（ont_concepts / ont_attributes / ont_entities / ont_relation_type）。
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class OntologyExploreService {

    /** 详情接口返回的实例数量上限，避免大表全量返回。 */
    private static final int DETAIL_INSTANCE_LIMIT = 50;

    private final ConceptRepository conceptRepository;
    private final ConceptAttributeRepository conceptAttributeRepository;
    private final AttributeRepository attributeRepository;
    private final EntityRepository entityRepository;
    private final EntityAttributeValueRepository entityAttributeValueRepository;
    private final RelationTypeRepository relationTypeRepository;
    private final ObjectMapper objectMapper;

    /**
     * 概念搜索（REQ-030）。
     *
     * @param keyword  关键字（匹配 name / description / code），可为空
     * @param attribute 属性名/编码（匹配属性的 name / code），可为空
     * @param tag       标签（匹配 metadata.tags），可为空
     * @return 命中概念列表（不含实例详情，attributes 仅返回 name/type/required/description）
     */
    @Transactional(readOnly = true)
    public List<OntologyConceptDto> search(String keyword, String attribute, String tag) {
        String tenantId = TenantContext.get();
        List<ConceptEntity> concepts = conceptRepository.findByTenantId(tenantId);

        // 属性维度过滤：先找出包含匹配属性的 conceptId 集合
        Set<String> conceptIdsWithAttribute = null;
        if (StringUtils.hasText(attribute)) {
            String attrLower = attribute.trim().toLowerCase();
            conceptIdsWithAttribute = new HashSet<>();
            for (AttributeEntity attr : attributeRepository.findByTenantId(tenantId)) {
                boolean matches = (attr.getName() != null && attr.getName().toLowerCase().contains(attrLower))
                        || (attr.getCode() != null && attr.getCode().toLowerCase().contains(attrLower));
                if (!matches) {
                    continue;
                }
                for (ConceptAttributeEntity assoc : conceptAttributeRepository
                        .findByTenantIdAndAttributeId(tenantId, attr.getAttributeId())) {
                    conceptIdsWithAttribute.add(assoc.getConceptId());
                }
            }
        }

        List<OntologyConceptDto> results = new ArrayList<>();
        for (ConceptEntity concept : concepts) {
            // 关键字过滤
            if (StringUtils.hasText(keyword)) {
                String kw = keyword.trim().toLowerCase();
                boolean matched = (concept.getName() != null && concept.getName().toLowerCase().contains(kw))
                        || (concept.getDescription() != null && concept.getDescription().toLowerCase().contains(kw))
                        || (concept.getCode() != null && concept.getCode().toLowerCase().contains(kw));
                if (!matched) {
                    continue;
                }
            }
            // 属性过滤
            if (conceptIdsWithAttribute != null && !conceptIdsWithAttribute.contains(concept.getConceptId())) {
                continue;
            }
            // 标签过滤
            List<String> tags = extractTags(concept.getMetadata());
            if (StringUtils.hasText(tag)) {
                String tagLower = tag.trim().toLowerCase();
                if (tags.stream().noneMatch(t -> t.toLowerCase().contains(tagLower))) {
                    continue;
                }
            }

            results.add(toDto(concept, false));
        }
        return results;
    }

    /**
     * 概念详情（REQ-031）。
     * 返回完整属性、前 {@value #DETAIL_INSTANCE_LIMIT} 条实例、关联概念 ID 列表。
     */
    @Transactional(readOnly = true)
    public OntologyConceptDto getDetail(String conceptId) {
        String tenantId = TenantContext.get();
        ConceptEntity concept = conceptRepository.findById(conceptId)
                .orElseThrow(() -> new OntException(ErrorCode.CONCEPT_NOT_FOUND));
        if (!tenantId.equals(concept.getTenantId())) {
            throw new OntException(ErrorCode.TENANT_MISMATCH);
        }
        return toDto(concept, true);
    }

    private OntologyConceptDto toDto(ConceptEntity concept, boolean withInstances) {
        String tenantId = concept.getTenantId();
        String conceptId = concept.getConceptId();

        // 属性
        List<OntologyConceptDto.ConceptAttributeDto> attributes = buildAttributes(tenantId, conceptId);

        // 实例
        List<OntologyConceptDto.ConceptInstanceDto> instances = withInstances
                ? buildInstances(tenantId, conceptId)
                : List.of();

        // 关联概念：从关系类型两端推导
        List<String> relatedConcepts = buildRelatedConcepts(tenantId, conceptId);

        return OntologyConceptDto.builder()
                .id(conceptId)
                .name(concept.getName())
                .definition(concept.getDescription())
                .attributes(attributes)
                .instances(instances)
                .relatedConcepts(relatedConcepts)
                .tags(extractTags(concept.getMetadata()))
                .build();
    }

    private List<OntologyConceptDto.ConceptAttributeDto> buildAttributes(String tenantId, String conceptId) {
        List<ConceptAttributeEntity> associations = conceptAttributeRepository
                .findByTenantIdAndConceptId(tenantId, conceptId);
        List<OntologyConceptDto.ConceptAttributeDto> result = new ArrayList<>();
        for (ConceptAttributeEntity assoc : associations) {
            Optional<AttributeEntity> opt = attributeRepository.findById(assoc.getAttributeId());
            if (opt.isEmpty()) {
                continue;
            }
            AttributeEntity attr = opt.get();
            result.add(OntologyConceptDto.ConceptAttributeDto.builder()
                    .name(attr.getName())
                    .type(attr.getDataType())
                    .required(Boolean.TRUE.equals(attr.getRequired()))
                    .description(attr.getDescription())
                    .build());
        }
        return result;
    }

    private List<OntologyConceptDto.ConceptInstanceDto> buildInstances(String tenantId, String conceptId) {
        List<EntityEntity> entities = entityRepository.findByTenantIdAndConceptId(tenantId, conceptId);
        List<OntologyConceptDto.ConceptInstanceDto> result = new ArrayList<>();
        int count = 0;
        for (EntityEntity entity : entities) {
            if (count >= DETAIL_INSTANCE_LIMIT) {
                break;
            }
            Map<String, Object> values = buildInstanceValues(tenantId, entity.getEntityId());
            result.add(OntologyConceptDto.ConceptInstanceDto.builder()
                    .id(entity.getEntityId())
                    .name(entity.getName())
                    .values(values)
                    .build());
            count++;
        }
        return result;
    }

    private Map<String, Object> buildInstanceValues(String tenantId, String entityId) {
        List<EntityAttributeValueEntity> values = entityAttributeValueRepository
                .findByTenantIdAndEntityId(tenantId, entityId);
        Map<String, Object> result = new LinkedHashMap<>();
        for (EntityAttributeValueEntity value : values) {
            Optional<AttributeEntity> opt = attributeRepository.findById(value.getAttributeId());
            if (opt.isEmpty()) {
                continue;
            }
            AttributeEntity attr = opt.get();
            result.put(attr.getCode(), toObject(value.getValue()));
        }
        return result;
    }

    private List<String> buildRelatedConcepts(String tenantId, String conceptId) {
        Set<String> ids = new java.util.LinkedHashSet<>();
        for (RelationTypeEntity type : relationTypeRepository.findByTenantIdAndSourceConceptId(tenantId, conceptId)) {
            ids.add(type.getTargetConceptId());
        }
        for (RelationTypeEntity type : relationTypeRepository.findByTenantIdAndTargetConceptId(tenantId, conceptId)) {
            ids.add(type.getSourceConceptId());
        }
        // 同时包含子概念作为相关概念
        for (ConceptEntity child : conceptRepository.findByTenantIdAndParentConceptId(tenantId, conceptId)) {
            ids.add(child.getConceptId());
        }
        // 父概念也算相关
        return new ArrayList<>(ids);
    }

    private List<String> extractTags(JsonNode metadata) {
        if (metadata == null || metadata.isNull() || !metadata.isObject()) {
            return Collections.emptyList();
        }
        JsonNode tagsNode = metadata.get("tags");
        if (tagsNode == null || !tagsNode.isArray()) {
            return Collections.emptyList();
        }
        List<String> tags = new ArrayList<>();
        for (JsonNode tag : tagsNode) {
            if (tag.isTextual()) {
                tags.add(tag.asText());
            }
        }
        return tags;
    }

    private Object toObject(JsonNode jsonNode) {
        if (jsonNode == null || jsonNode.isNull()) {
            return null;
        }
        return objectMapper.convertValue(jsonNode, Object.class);
    }
}
