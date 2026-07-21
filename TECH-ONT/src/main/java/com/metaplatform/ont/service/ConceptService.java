package com.metaplatform.ont.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.ont.common.ErrorCode;
import com.metaplatform.ont.common.OntStatus;
import com.metaplatform.ont.common.TenantContext;
import com.metaplatform.ont.dto.ConceptCreateRequest;
import com.metaplatform.ont.dto.ConceptHierarchyNode;
import com.metaplatform.ont.dto.ConceptHierarchyResponse;
import com.metaplatform.ont.dto.ConceptResponse;
import com.metaplatform.ont.dto.ConceptUpdateRequest;
import com.metaplatform.ont.dto.PageResponse;
import com.metaplatform.ont.entity.ConceptAttributeEntity;
import com.metaplatform.ont.entity.ConceptEntity;
import com.metaplatform.ont.exception.OntException;
import com.metaplatform.ont.repository.ConceptAttributeRepository;
import com.metaplatform.ont.repository.ConceptRepository;
import com.metaplatform.ont.repository.EntityRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.CollectionUtils;
import org.springframework.util.StringUtils;

import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ConceptService {

    private final ConceptRepository conceptRepository;
    private final ConceptAttributeRepository conceptAttributeRepository;
    private final EntityRepository entityRepository;
    private final ObjectMapper objectMapper;
    private final OntSyncService ontSyncService;
    private final EaWebhookService eaWebhookService;

    @Transactional
    public ConceptResponse create(ConceptCreateRequest request) {
        String tenantId = TenantContext.get();
        if (conceptRepository.existsByTenantIdAndCode(tenantId, request.getCode())) {
            throw new OntException(ErrorCode.CONCEPT_ALREADY_EXISTS);
        }
        if (conceptRepository.existsByTenantIdAndNameAndParentConceptId(tenantId, request.getName(), request.getParentConceptId())) {
            throw new OntException(ErrorCode.CONCEPT_ALREADY_EXISTS, "概念名称已存在");
        }

        ConceptEntity parent = null;
        if (StringUtils.hasText(request.getParentConceptId())) {
            parent = conceptRepository.findById(request.getParentConceptId())
                    .orElseThrow(() -> new OntException(ErrorCode.CONCEPT_NOT_FOUND));
            if (!tenantId.equals(parent.getTenantId())) {
                throw new OntException(ErrorCode.TENANT_MISMATCH);
            }
        }

        String conceptId = UUID.randomUUID().toString();
        int depth = parent == null ? 0 : parent.getDepth() + 1;
        int level = depth + 1; // level 是 1-indexed；根 = 1
        String path = parent == null ? "/" + conceptId : parent.getPath() + "/" + conceptId;

        ConceptEntity concept = ConceptEntity.builder()
                .conceptId(conceptId)
                .tenantId(tenantId)
                .code(request.getCode())
                .name(request.getName())
                .description(request.getDescription())
                .parentConceptId(request.getParentConceptId())
                .icon(request.getIcon())
                .metadata(toJsonNode(request.getMetadata()))
                .depth(depth)
                .level(level)
                .path(path)
                .status(OntStatus.ACTIVE)
                .createdBy(TenantContext.getUserId())
                .updatedBy(TenantContext.getUserId())
                .build();

        ConceptEntity saved = conceptRepository.save(concept);
        saveAttributeAssociations(tenantId, saved.getConceptId(), request.getAttributeIds(), false);

        ontSyncService.syncConcept(saved.getConceptId());

        eaWebhookService.notifyConceptChange(
                saved.getConceptId(), saved.getCode(), saved.getName(),
                "CREATED", buildChangePayload("parentConceptId", saved.getParentConceptId()));

        return toResponse(saved, request.getAttributeIds());
    }

    @Transactional(readOnly = true)
    public PageResponse<ConceptResponse> list() {
        String tenantId = TenantContext.get();
        List<ConceptEntity> concepts = conceptRepository.findByTenantId(tenantId);
        List<ConceptResponse> items = concepts.stream()
                .map(c -> toResponse(c, null))
                .toList();
        return PageResponse.<ConceptResponse>builder()
                .items(items)
                .total(items.size())
                .page(1)
                .pageSize(items.size())
                .totalPages(items.isEmpty() ? 0 : 1)
                .build();
    }

    @Transactional(readOnly = true)
    public ConceptResponse getById(String conceptId) {
        ConceptEntity concept = findConcept(conceptId);
        List<String> attributeIds = conceptAttributeRepository.findByTenantIdAndConceptId(concept.getTenantId(), conceptId).stream()
                .map(ConceptAttributeEntity::getAttributeId)
                .toList();
        return toResponse(concept, attributeIds);
    }

    @Transactional(readOnly = true)
    public ConceptResponse getByCode(String code) {
        String tenantId = TenantContext.get();
        ConceptEntity concept = conceptRepository.findByTenantIdAndCode(tenantId, code)
                .orElseThrow(() -> new OntException(ErrorCode.CONCEPT_NOT_FOUND));
        return getById(concept.getConceptId());
    }

    @Transactional
    public ConceptResponse update(String conceptId, ConceptUpdateRequest request) {
        String tenantId = TenantContext.get();
        ConceptEntity concept = findConcept(conceptId);

        if (StringUtils.hasText(request.getName()) && !request.getName().equals(concept.getName())) {
            if (conceptRepository.existsByTenantIdAndNameAndParentConceptIdAndConceptIdNot(
                    tenantId, request.getName(), concept.getParentConceptId(), conceptId)) {
                throw new OntException(ErrorCode.CONCEPT_ALREADY_EXISTS, "概念名称已存在");
            }
            concept.setName(request.getName());
        }
        if (request.getDescription() != null) {
            concept.setDescription(request.getDescription());
        }
        if (request.getIcon() != null) {
            concept.setIcon(request.getIcon());
        }
        if (request.getMetadata() != null) {
            concept.setMetadata(toJsonNode(request.getMetadata()));
        }
        concept.setUpdatedBy(TenantContext.getUserId());

        ConceptEntity saved = conceptRepository.save(concept);

        List<String> attributeIds = null;
        if (request.getAttributeIds() != null) {
            conceptAttributeRepository.deleteByTenantIdAndConceptId(tenantId, conceptId);
            saveAttributeAssociations(tenantId, conceptId, request.getAttributeIds(), false);
            attributeIds = request.getAttributeIds();
        }

        eaWebhookService.notifyConceptChange(
                saved.getConceptId(), saved.getCode(), saved.getName(),
                "UPDATED", buildChangePayload("parentConceptId", saved.getParentConceptId()));

        return toResponse(saved, attributeIds);
    }

    @Transactional
    public void delete(String conceptId) {
        String tenantId = TenantContext.get();
        ConceptEntity concept = findConcept(conceptId);

        if (conceptRepository.existsByTenantIdAndParentConceptId(tenantId, conceptId)) {
            throw new OntException(ErrorCode.CONCEPT_HAS_CHILDREN);
        }
        if (entityRepository.countByTenantIdAndConceptId(tenantId, conceptId) > 0) {
            throw new OntException(ErrorCode.CONCEPT_HAS_ENTITIES);
        }

        eaWebhookService.notifyConceptChange(
                concept.getConceptId(), concept.getCode(), concept.getName(),
                "DELETED", buildChangePayload("parentConceptId", concept.getParentConceptId()));

        conceptAttributeRepository.deleteByTenantIdAndConceptId(tenantId, conceptId);
        conceptRepository.delete(concept);
    }

    @Transactional
    public ConceptResponse createSubConcept(String parentId, ConceptCreateRequest request) {
        request.setParentConceptId(parentId);
        return create(request);
    }

    @Transactional
    public ConceptResponse moveConcept(String conceptId, String newParentId) {
        String tenantId = TenantContext.get();
        ConceptEntity concept = findConcept(conceptId);

        // 移动到自己或子孙下会形成环
        if (newParentId != null) {
            if (conceptId.equals(newParentId)) {
                throw new OntException(ErrorCode.CYCLIC_INHERITANCE, "不能将概念移动到自身下");
            }
            ConceptEntity newParent = conceptRepository.findById(newParentId)
                    .orElseThrow(() -> new OntException(ErrorCode.CONCEPT_NOT_FOUND, "新父概念不存在"));
            if (!tenantId.equals(newParent.getTenantId())) {
                throw new OntException(ErrorCode.TENANT_MISMATCH);
            }
            // 检测 newParent 是否是 conceptId 的后代
            String cursor = newParent.getParentConceptId();
            int safety = 1000;
            while (cursor != null && safety-- > 0) {
                if (conceptId.equals(cursor)) {
                    throw new OntException(ErrorCode.CYCLIC_INHERITANCE,
                            "目标父概念是当前概念的后代，会形成循环");
                }
                ConceptEntity ancestor = conceptRepository.findById(cursor).orElse(null);
                if (ancestor == null) {
                    break;
                }
                cursor = ancestor.getParentConceptId();
            }
        }

        concept.setParentConceptId(newParentId);
        ConceptEntity newParent = newParentId == null ? null : conceptRepository.findById(newParentId).orElse(null);
        int depth = newParent == null ? 0 : newParent.getDepth() + 1;
        concept.setDepth(depth);
        concept.setLevel(depth + 1);
        concept.setPath(buildPath(newParent, concept.getConceptId()));
        concept.setUpdatedBy(TenantContext.getUserId());

        ConceptEntity saved = conceptRepository.save(concept);
        // 子孙的 depth/path 也需要更新
        propagateToDescendants(saved);

        eaWebhookService.notifyConceptChange(
                saved.getConceptId(), saved.getCode(), saved.getName(),
                "MOVED", buildChangePayload("newParentConceptId", saved.getParentConceptId()));

        return toResponse(saved, null);
    }

    @Transactional(readOnly = true)
    public ConceptHierarchyResponse getHierarchy(String rootId, Integer maxDepth) {
        String tenantId = TenantContext.get();
        int depthLimit = maxDepth == null ? 5 : maxDepth;
        ConceptEntity root;
        if (StringUtils.hasText(rootId)) {
            root = findConcept(rootId);
        } else {
            // 默认为 tenant 的根概念列表（parent_concept_id IS NULL）
            List<ConceptEntity> roots = conceptRepository.findByTenantId(tenantId).stream()
                    .filter(c -> c.getParentConceptId() == null)
                    .toList();
            List<ConceptHierarchyNode> items = roots.stream()
                    .map(c -> toHierarchyNode(c, 0, depthLimit))
                    .filter(Objects::nonNull)
                    .toList();
            return ConceptHierarchyResponse.builder().items(items).build();
        }

        ConceptHierarchyNode node = toHierarchyNode(root, 0, depthLimit);
        return ConceptHierarchyResponse.builder().items(node == null ? List.of() : List.of(node)).build();
    }

    @Transactional(readOnly = true)
    public ConceptHierarchyResponse getAncestors(String conceptId) {
        ConceptEntity concept = findConcept(conceptId);
        List<ConceptHierarchyNode> chain = new ArrayList<>();
        String cursor = concept.getParentConceptId();
        int safety = 1000;
        while (cursor != null && safety-- > 0) {
            ConceptEntity ancestor = conceptRepository.findById(cursor).orElse(null);
            if (ancestor == null) {
                break;
            }
            chain.add(ConceptHierarchyNode.builder()
                    .conceptId(ancestor.getConceptId())
                    .code(ancestor.getCode())
                    .name(ancestor.getName())
                    .depth(ancestor.getDepth())
                    .parentConceptId(ancestor.getParentConceptId())
                    .build());
            cursor = ancestor.getParentConceptId();
        }
        Collections.reverse(chain);
        return ConceptHierarchyResponse.builder().items(chain).build();
    }

    @Transactional(readOnly = true)
    public ConceptHierarchyResponse getDescendants(String conceptId) {
        String tenantId = TenantContext.get();
        ConceptEntity concept = findConcept(conceptId);
        List<ConceptEntity> all = conceptRepository.findByTenantId(tenantId);
        Map<String, List<ConceptEntity>> childrenIndex = all.stream()
                .filter(c -> c.getParentConceptId() != null)
                .collect(Collectors.groupingBy(ConceptEntity::getParentConceptId));

        List<ConceptHierarchyNode> result = new ArrayList<>();
        Deque<ConceptEntity> stack = new ArrayDeque<>();
        List<ConceptEntity> direct = childrenIndex.getOrDefault(concept.getConceptId(), List.of());
        for (ConceptEntity child : direct) {
            stack.push(child);
        }
        int safety = 10000;
        while (!stack.isEmpty() && safety-- > 0) {
            ConceptEntity current = stack.pop();
            result.add(ConceptHierarchyNode.builder()
                    .conceptId(current.getConceptId())
                    .code(current.getCode())
                    .name(current.getName())
                    .depth(current.getDepth())
                    .parentConceptId(current.getParentConceptId())
                    .build());
            List<ConceptEntity> kids = childrenIndex.getOrDefault(current.getConceptId(), List.of());
            for (ConceptEntity k : kids) {
                stack.push(k);
            }
        }
        return ConceptHierarchyResponse.builder().items(result).build();
    }

    private ConceptEntity findConcept(String conceptId) {
        String tenantId = TenantContext.get();
        ConceptEntity concept = conceptRepository.findById(conceptId)
                .orElseThrow(() -> new OntException(ErrorCode.CONCEPT_NOT_FOUND));
        if (!tenantId.equals(concept.getTenantId())) {
            throw new OntException(ErrorCode.TENANT_MISMATCH);
        }
        return concept;
    }

    private String buildPath(ConceptEntity parent, String conceptId) {
        if (parent == null) {
            return "/" + conceptId;
        }
        return parent.getPath() + "/" + conceptId;
    }

    private void propagateToDescendants(ConceptEntity concept) {
        String tenantId = TenantContext.get();
        List<ConceptEntity> children = conceptRepository.findByTenantIdAndParentConceptId(tenantId, concept.getConceptId());
        for (ConceptEntity child : children) {
            int newDepth = concept.getDepth() + 1;
            child.setDepth(newDepth);
            child.setLevel(newDepth + 1);
            child.setPath(concept.getPath() + "/" + child.getConceptId());
            child.setUpdatedBy(TenantContext.getUserId());
            ConceptEntity savedChild = conceptRepository.save(child);
            propagateToDescendants(savedChild);
        }
    }

    private ConceptHierarchyNode toHierarchyNode(ConceptEntity concept, int currentDepth, int maxDepth) {
        if (currentDepth > maxDepth) {
            return null;
        }
        ConceptHierarchyNode node = ConceptHierarchyNode.builder()
                .conceptId(concept.getConceptId())
                .code(concept.getCode())
                .name(concept.getName())
                .depth(concept.getDepth())
                .parentConceptId(concept.getParentConceptId())
                .build();
        if (currentDepth == maxDepth) {
            return node;
        }
        // 此处只构建当前节点；层级树用 ancestors/descendants 端点递归覆盖
        return node;
    }

    private Map<String, Object> buildChangePayload(String key, Object value) {
        Map<String, Object> payload = new HashMap<>();
        if (value != null) {
            payload.put(key, value);
        }
        return payload;
    }

    private void saveAttributeAssociations(String tenantId, String conceptId, List<String> attributeIds, boolean inherited) {
        if (CollectionUtils.isEmpty(attributeIds)) {
            return;
        }
        for (String attributeId : attributeIds) {
            ConceptAttributeEntity association = ConceptAttributeEntity.builder()
                    .tenantId(tenantId)
                    .conceptId(conceptId)
                    .attributeId(attributeId)
                    .inherited(inherited)
                    .build();
            conceptAttributeRepository.save(association);
        }
    }

    private ConceptResponse toResponse(ConceptEntity concept, List<String> attributeIds) {
        long entityCount = entityRepository.countByTenantIdAndConceptId(concept.getTenantId(), concept.getConceptId());
        long childCount = conceptRepository.countByTenantIdAndParentConceptId(concept.getTenantId(), concept.getConceptId());
        List<String> attrs = attributeIds;
        if (attrs == null) {
            attrs = conceptAttributeRepository.findByTenantIdAndConceptId(concept.getTenantId(), concept.getConceptId()).stream()
                    .map(ConceptAttributeEntity::getAttributeId)
                    .toList();
        }
        return ConceptResponse.builder()
                .conceptId(concept.getConceptId())
                .tenantId(concept.getTenantId())
                .code(concept.getCode())
                .name(concept.getName())
                .description(concept.getDescription())
                .parentConceptId(concept.getParentConceptId())
                .icon(concept.getIcon())
                .metadata(toMap(concept.getMetadata()))
                .depth(concept.getDepth())
                .level(concept.getLevel())
                .path(concept.getPath())
                .status(concept.getStatus().name())
                .attributeIds(attrs)
                .entityCount(entityCount)
                .childCount(childCount)
                .createdAt(concept.getCreatedAt())
                .updatedAt(concept.getUpdatedAt())
                .createdBy(concept.getCreatedBy())
                .updatedBy(concept.getUpdatedBy())
                .build();
    }

    private JsonNode toJsonNode(Object value) {
        if (value == null) {
            return null;
        }
        return objectMapper.valueToTree(value);
    }

    private Map<String, Object> toMap(JsonNode jsonNode) {
        if (jsonNode == null) {
            return null;
        }
        return objectMapper.convertValue(jsonNode, Map.class);
    }
}
