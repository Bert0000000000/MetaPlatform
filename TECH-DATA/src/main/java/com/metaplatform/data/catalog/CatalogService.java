package com.metaplatform.data.catalog;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.fasterxml.jackson.core.type.TypeReference;
import com.metaplatform.data.common.ErrorCode;
import com.metaplatform.data.common.PageResponse;
import com.metaplatform.data.common.TenantContext;
import com.metaplatform.data.catalog.dto.AssetLineageResponse;
import com.metaplatform.data.catalog.dto.AssetProfileResponse;
import com.metaplatform.data.catalog.dto.CatalogAssetResponse;
import com.metaplatform.data.entity.CatalogAssetEntity;
import com.metaplatform.data.exception.DataException;
import com.metaplatform.data.repository.CatalogAssetRepository;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Example;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.Collections;
import java.util.List;
import java.util.UUID;

/**
 * 数据目录服务：资产 list/detail/metadata/lineage/profile + search。
 *
 * <p>对应 Python app/catalog/service.py 的 CatalogService。</p>
 *
 * <p>持久化存储（catalog_asset 表），启动时初始化 3 个 seed 资产（仅在表为空时）。</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CatalogService {

    private static final String TENANT_DEFAULT = "tenant-default";

    private final ObjectMapper objectMapper;
    private final CatalogAssetRepository catalogAssetRepository;

    /**
     * 启动时初始化 seed 资产（仅在表为空时插入）。
     */
    @PostConstruct
    @Transactional
    public void initSeedData() {
        if (catalogAssetRepository.count() > 0) {
            return;
        }
        log.info("初始化 catalog seed 资产...");
        seedAsset("asset-001", TENANT_DEFAULT, "TABLE", "orders", "postgres-main",
                "订单主表", "data-team", List.of("sales", "transaction"),
                "{\"schema\":\"public\",\"rows\":1000}");
        seedAsset("asset-002", TENANT_DEFAULT, "TABLE", "customers", "postgres-main",
                "客户主数据", "data-team", List.of("master", "mdm"),
                "{\"schema\":\"metaplatform\",\"rows\":500}");
        seedAsset("asset-003", TENANT_DEFAULT, "TABLE", "events_hudi", "lakehouse",
                "事件日志湖表", "data-platform", List.of("events", "raw"),
                "{\"format\":\"hudi\",\"rows\":10000}");
        log.info("catalog seed 资产初始化完成 (3 条)");
    }

    /**
     * 资产列表。
     */
    @Transactional(readOnly = true)
    public PageResponse<CatalogAssetResponse> list(String type, String owner, int page, int pageSize) {
        String tenantId = TenantContext.getTenantIdOrDefault();
        PageRequest pageable = PageRequest.of(Math.max(page - 1, 0), pageSize,
                Sort.by(Sort.Direction.DESC, "createdAt"));

        CatalogAssetEntity probe = new CatalogAssetEntity();
        probe.setTenantId(tenantId);
        if (type != null && !type.isBlank()) {
            probe.setType(type);
        }
        if (owner != null && !owner.isBlank()) {
            probe.setOwner(owner);
        }
        Page<CatalogAssetEntity> result = catalogAssetRepository.findAll(Example.of(probe), pageable);

        return PageResponse.of(
                result.getContent().stream().map(this::toResponse).toList(),
                result.getTotalElements(), page, pageSize);
    }

    @Transactional(readOnly = true)
    public CatalogAssetResponse get(String assetId) {
        return toResponse(requireAsset(assetId));
    }

    /**
     * 获取资产元数据。
     */
    @Transactional(readOnly = true)
    public JsonNode getMetadata(String assetId) {
        CatalogAssetEntity entity = requireAsset(assetId);
        return parseJson(entity.getSchemaJson());
    }

    /**
     * 获取资产血缘（stub：依赖 LineageService，仅返回空上下游）。
     */
    @Transactional(readOnly = true)
    public AssetLineageResponse getLineage(String assetId) {
        requireAsset(assetId);
        return AssetLineageResponse.builder()
                .assetId(assetId)
                .upstreamAssetIds(Collections.emptyList())
                .downstreamAssetIds(Collections.emptyList())
                .build();
    }

    /**
     * 获取资产数据画像（stub：依赖外部数据探查，返回空列信息）。
     */
    @Transactional(readOnly = true)
    public AssetProfileResponse getProfile(String assetId) {
        requireAsset(assetId);
        return AssetProfileResponse.builder()
                .assetId(assetId)
                .rowCount(0L)
                .sizeBytes(0L)
                .lastProfiledAt(OffsetDateTime.now())
                .columns(Collections.emptyList())
                .build();
    }

    /**
     * 全局搜索（按 name/description/tags ILIKE，内存过滤）。
     */
    @Transactional(readOnly = true)
    public PageResponse<CatalogAssetResponse> search(String keyword, int page, int pageSize) {
        String tenantId = TenantContext.getTenantIdOrDefault();
        String lower = keyword != null ? keyword.toLowerCase() : "";

        PageRequest pageable = PageRequest.of(0, Integer.MAX_VALUE,
                Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<CatalogAssetEntity> all = catalogAssetRepository.findByTenantId(tenantId, pageable);

        List<CatalogAssetResponse> filtered = all.getContent().stream()
                .filter(a -> lower.isBlank()
                        || (a.getName() != null && a.getName().toLowerCase().contains(lower))
                        || (a.getDescription() != null && a.getDescription().toLowerCase().contains(lower))
                        || tagsContain(a.getTags(), lower))
                .map(this::toResponse)
                .toList();

        int total = filtered.size();
        int from = Math.min((page - 1) * pageSize, total);
        int to = Math.min(from + pageSize, total);
        List<CatalogAssetResponse> slice = from < to ? filtered.subList(from, to) : Collections.emptyList();
        return PageResponse.of(slice, total, page, pageSize);
    }

    // =====================================================================
    // 内部辅助方法
    // =====================================================================

    private CatalogAssetEntity requireAsset(String assetId) {
        String tenantId = TenantContext.getTenantIdOrDefault();
        return catalogAssetRepository.findByIdAndTenantId(assetId, tenantId)
                .orElseThrow(() -> new DataException(ErrorCode.CATALOG_ASSET_NOT_FOUND, "资产不存在: " + assetId));
    }

    private void seedAsset(String id, String tenantId, String type, String name, String source,
                           String description, String owner, List<String> tags, String schemaJson) {
        CatalogAssetEntity entity = new CatalogAssetEntity();
        entity.setId(id);
        entity.setTenantId(tenantId);
        entity.setType(type);
        entity.setName(name);
        entity.setSource(source);
        entity.setDescription(description);
        entity.setOwner(owner);
        entity.setTags(serializeStringList(tags));
        entity.setSchemaJson(schemaJson);
        entity.setStatus("ACTIVE");
        catalogAssetRepository.save(entity);
    }

    private boolean tagsContain(String tagsJson, String lower) {
        if (tagsJson == null || tagsJson.isBlank()) return false;
        try {
            List<String> tags = objectMapper.readValue(tagsJson, new TypeReference<List<String>>() {});
            return tags.stream().anyMatch(t -> t != null && t.toLowerCase().contains(lower));
        } catch (Exception e) {
            return false;
        }
    }

    private CatalogAssetResponse toResponse(CatalogAssetEntity entity) {
        return CatalogAssetResponse.builder()
                .assetId(entity.getId())
                .tenantId(entity.getTenantId())
                .type(entity.getType())
                .name(entity.getName())
                .source(entity.getSource())
                .description(entity.getDescription())
                .owner(entity.getOwner())
                .tags(parseStringList(entity.getTags()))
                .metadata(parseJson(entity.getSchemaJson()))
                .status(entity.getStatus())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }

    private String serializeStringList(List<String> list) {
        if (list == null) return null;
        try {
            return objectMapper.writeValueAsString(list);
        } catch (Exception e) {
            return null;
        }
    }

    private List<String> parseStringList(String json) {
        if (json == null || json.isBlank()) return Collections.emptyList();
        try {
            return objectMapper.readValue(json, new TypeReference<List<String>>() {});
        } catch (Exception e) {
            return Collections.emptyList();
        }
    }

    private JsonNode parseJson(String json) {
        if (json == null || json.isBlank()) return objectMapper.createObjectNode();
        try {
            return objectMapper.readTree(json);
        } catch (Exception e) {
            return objectMapper.createObjectNode();
        }
    }
}
