package com.metaplatform.ont.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.metaplatform.ont.common.ErrorCode;
import com.metaplatform.ont.common.TenantContext;
import com.metaplatform.ont.dto.OntologyVersionCompareResponse;
import com.metaplatform.ont.dto.OntologyVersionCreateRequest;
import com.metaplatform.ont.dto.OntologyVersionResponse;
import com.metaplatform.ont.dto.OntologyVersionUpdateRequest;
import com.metaplatform.ont.dto.PageResponse;
import com.metaplatform.ont.entity.*;
import com.metaplatform.ont.exception.OntException;
import com.metaplatform.ont.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;
import java.util.stream.StreamSupport;

@Service
@RequiredArgsConstructor
public class OntologyVersionService {

    private final OntologyVersionRepository versionRepository;
    private final ConceptRepository conceptRepository;
    private final AttributeRepository attributeRepository;
    private final ConceptAttributeRepository conceptAttributeRepository;
    private final RelationTypeRepository relationTypeRepository;
    private final RelationInstanceRepository relationInstanceRepository;
    private final EntityRepository entityRepository;
    private final EntityAttributeValueRepository entityAttributeValueRepository;
    private final ObjectMapper objectMapper;

    @Transactional
    public OntologyVersionResponse createSnapshot(OntologyVersionCreateRequest request) {
        String tenantId = TenantContext.get();
        int nextVersion = versionRepository.findTopByTenantIdOrderByVersionNumberDesc(tenantId)
                .map(v -> v.getVersionNumber() + 1)
                .orElse(1);

        JsonNode snapshot = buildSnapshot(tenantId);
        OntologyVersionEntity version = OntologyVersionEntity.builder()
                .versionId(UUID.randomUUID().toString())
                .tenantId(tenantId)
                .versionNumber(nextVersion)
                .name(request.getName())
                .description(request.getDescription())
                .status("DRAFT")
                .snapshot(snapshot)
                .current(false)
                .createdBy(TenantContext.getUserId())
                .build();

        OntologyVersionEntity saved = versionRepository.save(version);
        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public PageResponse<OntologyVersionResponse> list(int page, int pageSize) {
        String tenantId = TenantContext.get();
        List<OntologyVersionEntity> all = versionRepository.findByTenantIdOrderByVersionNumberDesc(tenantId);
        int from = Math.max(0, (page - 1) * pageSize);
        int to = Math.min(all.size(), from + pageSize);
        List<OntologyVersionResponse> items = all.subList(from, to).stream().map(this::toResponse).toList();
        int totalPages = all.isEmpty() ? 0 : (int) Math.ceil((double) all.size() / pageSize);
        return PageResponse.<OntologyVersionResponse>builder()
                .items(items)
                .total(all.size())
                .page(page)
                .pageSize(pageSize)
                .totalPages(totalPages)
                .build();
    }

    @Transactional(readOnly = true)
    public OntologyVersionResponse getById(String versionId) {
        String tenantId = TenantContext.get();
        OntologyVersionEntity version = versionRepository.findByVersionIdAndTenantId(versionId, tenantId)
                .orElseThrow(() -> new OntException(ErrorCode.VERSION_NOT_FOUND));
        return toResponse(version);
    }

    @Transactional(readOnly = true)
    public OntologyVersionResponse getCurrent() {
        String tenantId = TenantContext.get();
        OntologyVersionEntity version = versionRepository.findByTenantIdAndCurrentTrue(tenantId)
                .orElseThrow(() -> new OntException(ErrorCode.VERSION_NOT_FOUND, "当前没有已发布版本"));
        return toResponse(version);
    }

    @Transactional
    public OntologyVersionResponse publish(String versionId) {
        String tenantId = TenantContext.get();
        OntologyVersionEntity version = versionRepository.findByVersionIdAndTenantId(versionId, tenantId)
                .orElseThrow(() -> new OntException(ErrorCode.VERSION_NOT_FOUND));
        if (!"DRAFT".equals(version.getStatus())) {
            throw new OntException(ErrorCode.VERSION_CONFLICT, "只能发布草稿状态的版本");
        }

        versionRepository.findByTenantIdAndCurrentTrue(tenantId)
                .ifPresent(current -> {
                    current.setCurrent(false);
                    versionRepository.save(current);
                });

        version.setStatus("PUBLISHED");
        version.setCurrent(true);
        version.setPublishedAt(Instant.now());
        OntologyVersionEntity saved = versionRepository.save(version);
        return toResponse(saved);
    }

    @Transactional
    public OntologyVersionResponse rollback(String versionId) {
        String tenantId = TenantContext.get();
        OntologyVersionEntity version = versionRepository.findByVersionIdAndTenantId(versionId, tenantId)
                .orElseThrow(() -> new OntException(ErrorCode.VERSION_NOT_FOUND));
        if (!"PUBLISHED".equals(version.getStatus())) {
            throw new OntException(ErrorCode.VERSION_NOT_PUBLISHED);
        }

        restoreSnapshot(tenantId, version.getSnapshot());

        versionRepository.findByTenantIdAndCurrentTrue(tenantId)
                .ifPresent(current -> {
                    if (!current.getVersionId().equals(version.getVersionId())) {
                        current.setCurrent(false);
                        versionRepository.save(current);
                    }
                });

        version.setCurrent(true);
        OntologyVersionEntity saved = versionRepository.save(version);
        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public OntologyVersionCompareResponse compare(String sourceVersionId, String targetVersionId) {
        String tenantId = TenantContext.get();
        OntologyVersionEntity source = versionRepository.findByVersionIdAndTenantId(sourceVersionId, tenantId)
                .orElseThrow(() -> new OntException(ErrorCode.VERSION_NOT_FOUND));

        JsonNode targetSnapshot;
        String resolvedTargetId;
        if (targetVersionId == null || targetVersionId.isBlank()) {
            OntologyVersionEntity current = versionRepository.findByTenantIdAndCurrentTrue(tenantId)
                    .orElseThrow(() -> new OntException(ErrorCode.VERSION_NOT_FOUND, "没有当前版本可对比"));
            targetSnapshot = current.getSnapshot();
            resolvedTargetId = current.getVersionId();
        } else {
            OntologyVersionEntity target = versionRepository.findByVersionIdAndTenantId(targetVersionId, tenantId)
                    .orElseThrow(() -> new OntException(ErrorCode.VERSION_NOT_FOUND));
            targetSnapshot = target.getSnapshot();
            resolvedTargetId = target.getVersionId();
        }

        Map<String, OntologyVersionCompareResponse.ChangeSummary> changes = new LinkedHashMap<>();
        for (String key : List.of("concepts", "attributes", "relationTypes", "relationInstances", "entities")) {
            changes.put(key, compareArray(source.getSnapshot().get(key), targetSnapshot.get(key)));
        }

        return OntologyVersionCompareResponse.builder()
                .sourceVersionId(sourceVersionId)
                .targetVersionId(resolvedTargetId)
                .changes(changes)
                .build();
    }

    /**
     * 修复 #2: 列出所有 version（不分页），按 versionNumber desc 排序。
     */
    @Transactional(readOnly = true)
    public List<OntologyVersionResponse> listAll() {
        String tenantId = TenantContext.get();
        return versionRepository.findByTenantIdOrderByVersionNumberDesc(tenantId).stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    /**
     * 修复 #3: 通过两个 ID 比较（前端 GET /compare?aId&bId 调用形式）。
     */
    @Transactional(readOnly = true)
    public OntologyVersionCompareResponse compareByTwoIds(String aId, String bId) {
        String tenantId = TenantContext.get();
        OntologyVersionEntity a = versionRepository.findByVersionIdAndTenantId(aId, tenantId)
                .orElseThrow(() -> new OntException(ErrorCode.VERSION_NOT_FOUND, "Version not found: " + aId));
        OntologyVersionEntity b = versionRepository.findByVersionIdAndTenantId(bId, tenantId)
                .orElseThrow(() -> new OntException(ErrorCode.VERSION_NOT_FOUND, "Version not found: " + bId));

        Map<String, OntologyVersionCompareResponse.ChangeSummary> changes = new LinkedHashMap<>();
        for (String key : List.of("concepts", "attributes", "relationTypes", "relationInstances", "entities")) {
            changes.put(key, compareArray(a.getSnapshot().get(key), b.getSnapshot().get(key)));
        }

        return OntologyVersionCompareResponse.builder()
                .sourceVersionId(aId)
                .targetVersionId(bId)
                .changes(changes)
                .build();
    }

    /**
     * 修复 #4: 更新 version 的 description（当前实体无 changelog/updatedAt 列，仅更新 description）。
     */
    @Transactional
    public OntologyVersionResponse update(String versionId, OntologyVersionUpdateRequest req) {
        String tenantId = TenantContext.get();
        OntologyVersionEntity v = versionRepository.findByVersionIdAndTenantId(versionId, tenantId)
                .orElseThrow(() -> new OntException(ErrorCode.VERSION_NOT_FOUND));
        v.setDescription(req.getDescription());
        OntologyVersionEntity saved = versionRepository.save(v);
        return toResponse(saved);
    }

    /**
     * 修复 #5: 删除 version。
     */
    @Transactional
    public void delete(String versionId) {
        String tenantId = TenantContext.get();
        OntologyVersionEntity v = versionRepository.findByVersionIdAndTenantId(versionId, tenantId)
                .orElseThrow(() -> new OntException(ErrorCode.VERSION_NOT_FOUND));
        if (Boolean.TRUE.equals(v.getCurrent())) {
            throw new OntException(ErrorCode.VERSION_CONFLICT, "不能删除当前激活版本");
        }
        versionRepository.delete(v);
    }

    private JsonNode buildSnapshot(String tenantId) {
        ObjectNode root = objectMapper.createObjectNode();
        root.set("concepts", objectMapper.valueToTree(conceptRepository.findByTenantId(tenantId)));
        root.set("attributes", objectMapper.valueToTree(attributeRepository.findByTenantId(tenantId)));
        root.set("conceptAttributes", objectMapper.valueToTree(conceptAttributeRepository.findByTenantId(tenantId)));
        root.set("relationTypes", objectMapper.valueToTree(relationTypeRepository.findByTenantId(tenantId)));
        root.set("relationInstances", objectMapper.valueToTree(relationInstanceRepository.findByTenantId(tenantId)));
        root.set("entities", objectMapper.valueToTree(entityRepository.findByTenantId(tenantId)));
        List<EntityAttributeValueEntity> values = new ArrayList<>();
        entityRepository.findByTenantId(tenantId).forEach(e ->
                values.addAll(entityAttributeValueRepository.findByTenantIdAndEntityId(tenantId, e.getEntityId())));
        root.set("entityAttributeValues", objectMapper.valueToTree(values));
        return root;
    }

    private OntologyVersionCompareResponse.ChangeSummary compareArray(JsonNode source, JsonNode target) {
        if (source == null && target == null) {
            return OntologyVersionCompareResponse.ChangeSummary.builder().added(0).removed(0).modified(0).build();
        }
        Map<String, JsonNode> sourceMap = idMap(source);
        Map<String, JsonNode> targetMap = idMap(target);
        int added = 0;
        int removed = 0;
        int modified = 0;
        for (String id : targetMap.keySet()) {
            if (!sourceMap.containsKey(id)) {
                added++;
            }
        }
        for (Map.Entry<String, JsonNode> entry : sourceMap.entrySet()) {
            JsonNode t = targetMap.get(entry.getKey());
            if (t == null) {
                removed++;
            } else if (!entry.getValue().equals(t)) {
                modified++;
            }
        }
        return OntologyVersionCompareResponse.ChangeSummary.builder()
                .added(added).removed(removed).modified(modified).build();
    }

    private Map<String, JsonNode> idMap(JsonNode array) {
        if (array == null || !array.isArray()) {
            return Collections.emptyMap();
        }
        Map<String, JsonNode> map = new HashMap<>();
        for (JsonNode node : array) {
            JsonNode idNode = node.get("id");
            if (idNode == null) {
                idNode = node.get("conceptId");
            }
            if (idNode == null) {
                idNode = node.get("attributeId");
            }
            if (idNode == null) {
                idNode = node.get("relationTypeId");
            }
            if (idNode == null) {
                idNode = node.get("relationInstanceId");
            }
            if (idNode == null) {
                idNode = node.get("entityId");
            }
            if (idNode != null && !idNode.isNull()) {
                map.put(idNode.asText(), node);
            }
        }
        return map;
    }

    private void restoreSnapshot(String tenantId, JsonNode snapshot) {
        restoreEntities(snapshot.get("concepts"), ConceptEntity.class, conceptRepository);
        restoreEntities(snapshot.get("attributes"), AttributeEntity.class, attributeRepository);
        restoreEntities(snapshot.get("conceptAttributes"), ConceptAttributeEntity.class, conceptAttributeRepository);
        restoreEntities(snapshot.get("relationTypes"), RelationTypeEntity.class, relationTypeRepository);
        restoreEntities(snapshot.get("relationInstances"), RelationInstanceEntity.class, relationInstanceRepository);
        restoreEntities(snapshot.get("entities"), EntityEntity.class, entityRepository);
        restoreEntities(snapshot.get("entityAttributeValues"), EntityAttributeValueEntity.class, entityAttributeValueRepository);
    }

    private <T> void restoreEntities(JsonNode array, Class<T> type, JpaRepository<T, ?> repository) {
        if (array == null || !array.isArray() || array.isEmpty()) {
            return;
        }
        List<T> entities = StreamSupport.stream(array.spliterator(), false)
                .map(node -> objectMapper.convertValue(node, type))
                .toList();
        repository.saveAll(entities);
    }

    private OntologyVersionResponse toResponse(OntologyVersionEntity entity) {
        return OntologyVersionResponse.builder()
                .versionId(entity.getVersionId())
                .versionNumber(entity.getVersionNumber())
                .name(entity.getName())
                .description(entity.getDescription())
                .status(entity.getStatus())
                .current(entity.getCurrent())
                .publishedAt(entity.getPublishedAt())
                .createdAt(entity.getCreatedAt())
                .createdBy(entity.getCreatedBy())
                .snapshot(entity.getSnapshot())
                .build();
    }
}
