package com.metaplatform.ea.dataarchitecture.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.ea.common.ErrorCode;
import com.metaplatform.ea.common.TenantContext;
import com.metaplatform.ea.dataarchitecture.dto.CreateDataAssetRequest;
import com.metaplatform.ea.dataarchitecture.dto.DataAssetCatalogResponse;
import com.metaplatform.ea.dataarchitecture.dto.DataAssetResponse;
import com.metaplatform.ea.dataarchitecture.dto.UpdateDataAssetRequest;
import com.metaplatform.ea.dataarchitecture.entity.DataAssetEntity;
import com.metaplatform.ea.dataarchitecture.repository.DataAssetRepository;
import com.metaplatform.ea.exception.EaException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.CollectionUtils;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class DataAssetService {

    private final DataAssetRepository repository;
    private final ObjectMapper objectMapper;

    @Transactional
    public DataAssetResponse create(CreateDataAssetRequest request) {
        String tenantId = TenantContext.getOrDefault();
        if (repository.existsByTenantIdAndCodeAndDeletedAtIsNull(tenantId, request.getCode())) {
            throw new EaException(ErrorCode.ALREADY_EXISTS,
                    "数据资产编码已存在: " + request.getCode());
        }
        Instant now = Instant.now();
        DataAssetEntity entity = DataAssetEntity.builder()
                .tenantId(tenantId)
                .name(request.getName())
                .code(request.getCode())
                .assetType(request.getAssetType())
                .description(request.getDescription())
                .entityId(request.getEntityId())
                .classification(request.getClassification())
                .metadata(request.getMetadata() != null ? request.getMetadata() : "{}")
                .tags(toTags(request.getTags()))
                .createdAt(now)
                .updatedAt(now)
                .build();
        return toResponse(repository.save(entity));
    }

    @Transactional(readOnly = true)
    public List<DataAssetResponse> list(String keyword, String assetType, String classification) {
        String tenantId = TenantContext.getOrDefault();
        return repository.findByTenantIdAndDeletedAtIsNull(tenantId).stream()
                .filter(a -> !StringUtils.hasText(keyword)
                        || containsIgnoreCase(a.getName(), keyword)
                        || containsIgnoreCase(a.getCode(), keyword)
                        || containsIgnoreCase(a.getDescription(), keyword))
                .filter(a -> !StringUtils.hasText(assetType) || assetType.equals(a.getAssetType()))
                .filter(a -> !StringUtils.hasText(classification) || classification.equals(a.getClassification()))
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public DataAssetResponse get(UUID id) {
        return toResponse(findById(id));
    }

    @Transactional
    public DataAssetResponse update(UUID id, UpdateDataAssetRequest request) {
        DataAssetEntity entity = findById(id);
        if (StringUtils.hasText(request.getName())) entity.setName(request.getName());
        if (request.getDescription() != null) entity.setDescription(request.getDescription());
        if (request.getEntityId() != null) entity.setEntityId(request.getEntityId());
        if (request.getClassification() != null) entity.setClassification(request.getClassification());
        if (request.getMetadata() != null) entity.setMetadata(request.getMetadata());
        if (request.getTags() != null) entity.setTags(toTags(request.getTags()));
        entity.setUpdatedAt(Instant.now());
        return toResponse(repository.save(entity));
    }

    @Transactional
    public void delete(UUID id) {
        DataAssetEntity entity = findById(id);
        Instant now = Instant.now();
        entity.setDeletedAt(now);
        entity.setUpdatedAt(now);
        repository.save(entity);
    }

    @Transactional(readOnly = true)
    public DataAssetCatalogResponse catalog(String groupBy) {
        String tenantId = TenantContext.getOrDefault();
        List<DataAssetResponse> assets = repository.findByTenantIdAndDeletedAtIsNull(tenantId)
                .stream().map(this::toResponse).toList();

        Map<String, List<DataAssetResponse>> grouped = new LinkedHashMap<>();
        switch (groupBy != null ? groupBy : "type") {
            case "classification" -> grouped = assets.stream()
                    .collect(Collectors.groupingBy(a -> StringUtils.hasText(a.getClassification())
                            ? a.getClassification() : "未分类", LinkedHashMap::new, Collectors.toList()));
            case "tag" -> {
                for (DataAssetResponse asset : assets) {
                    List<String> tags = asset.getTags();
                    if (CollectionUtils.isEmpty(tags)) {
                        grouped.computeIfAbsent("未打标签", k -> new java.util.ArrayList<>()).add(asset);
                    } else {
                        for (String tag : tags) {
                            grouped.computeIfAbsent(tag, k -> new java.util.ArrayList<>()).add(asset);
                        }
                    }
                }
            }
            default -> grouped = assets.stream()
                    .collect(Collectors.groupingBy(a -> StringUtils.hasText(a.getAssetType())
                            ? a.getAssetType() : "未指定", LinkedHashMap::new, Collectors.toList()));
        }

        List<DataAssetCatalogResponse.CatalogGroup> groups = grouped.entrySet().stream()
                .map(e -> DataAssetCatalogResponse.CatalogGroup.builder()
                        .key(e.getKey())
                        .label(e.getKey())
                        .assets(e.getValue())
                        .build())
                .toList();
        return DataAssetCatalogResponse.builder()
                .groupBy(groupBy != null ? groupBy : "type")
                .groups(groups)
                .build();
    }

    public DataAssetEntity findById(UUID id) {
        String tenantId = TenantContext.getOrDefault();
        return repository.findByIdAndDeletedAtIsNull(id)
                .filter(e -> e.getTenantId().equals(tenantId))
                .orElseThrow(() -> new EaException(ErrorCode.NOT_FOUND, "数据资产不存在"));
    }

    private DataAssetResponse toResponse(DataAssetEntity entity) {
        return DataAssetResponse.builder()
                .id(entity.getId())
                .tenantId(entity.getTenantId())
                .name(entity.getName())
                .code(entity.getCode())
                .assetType(entity.getAssetType())
                .description(entity.getDescription())
                .entityId(entity.getEntityId())
                .classification(entity.getClassification())
                .metadata(entity.getMetadata())
                .tags(fromTags(entity.getTags()))
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }

    private String toTags(List<String> tags) {
        try {
            return objectMapper.writeValueAsString(tags != null ? tags : Collections.emptyList());
        } catch (JsonProcessingException e) {
            throw new EaException(ErrorCode.INTERNAL_ERROR, "标签序列化失败: " + e.getMessage());
        }
    }

    private List<String> fromTags(String tags) {
        try {
            if (!StringUtils.hasText(tags)) {
                return Collections.emptyList();
            }
            return objectMapper.readValue(tags, new TypeReference<List<String>>() {});
        } catch (JsonProcessingException e) {
            throw new EaException(ErrorCode.INTERNAL_ERROR, "标签反序列化失败: " + e.getMessage());
        }
    }

    private boolean containsIgnoreCase(String value, String keyword) {
        return value != null && value.toLowerCase().contains(keyword.toLowerCase());
    }
}
