package com.metaplatform.ea.techradar.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.ea.common.ErrorCode;
import com.metaplatform.ea.common.TenantContext;
import com.metaplatform.ea.exception.EaException;
import com.metaplatform.ea.techradar.dto.CreateTechnologyRadarRequest;
import com.metaplatform.ea.techradar.dto.TechnologyRadarItem;
import com.metaplatform.ea.techradar.dto.TechnologyRadarResponse;
import com.metaplatform.ea.techradar.dto.UpdateTechnologyRadarRequest;
import com.metaplatform.ea.techradar.entity.TechnologyRadarEntity;
import com.metaplatform.ea.techradar.repository.TechnologyRadarRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class TechnologyRadarService {

    private final TechnologyRadarRepository repository;
    private final ObjectMapper objectMapper;

    @Transactional
    public TechnologyRadarResponse create(CreateTechnologyRadarRequest request) {
        String tenantId = TenantContext.getOrDefault();
        String name = request.getName().trim();
        if (repository.existsByTenantIdAndNameAndDeletedAtIsNull(tenantId, name)) {
            throw new EaException(ErrorCode.ALREADY_EXISTS, "该租户下已存在同名技术雷达: " + name);
        }
        Instant now = Instant.now();
        TechnologyRadarEntity entity = TechnologyRadarEntity.builder()
                .tenantId(tenantId)
                .name(name)
                .quadrants(toJson(request.getQuadrants(), defaultQuadrants()))
                .rings(toJson(request.getRings(), defaultRings()))
                .items(toJson(request.getItems()))
                .status(StringUtils.hasText(request.getStatus()) ? request.getStatus().toLowerCase() : "active")
                .createdAt(now)
                .updatedAt(now)
                .build();
        return toResponse(repository.save(entity));
    }

    @Transactional(readOnly = true)
    public List<TechnologyRadarResponse> list() {
        String tenantId = TenantContext.getOrDefault();
        return repository.findByTenantIdAndDeletedAtIsNull(tenantId).stream()
                .map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public TechnologyRadarResponse get(UUID id) {
        return toResponse(findById(id));
    }

    @Transactional
    public TechnologyRadarResponse update(UUID id, UpdateTechnologyRadarRequest request) {
        TechnologyRadarEntity entity = findById(id);
        if (StringUtils.hasText(request.getName())) {
            String newName = request.getName().trim();
            if (!newName.equals(entity.getName())
                    && repository.existsByTenantIdAndNameAndDeletedAtIsNull(entity.getTenantId(), newName)) {
                throw new EaException(ErrorCode.ALREADY_EXISTS, "该租户下已存在同名技术雷达: " + newName);
            }
            entity.setName(newName);
        }
        if (request.getQuadrants() != null) entity.setQuadrants(toJson(request.getQuadrants(), defaultQuadrants()));
        if (request.getRings() != null) entity.setRings(toJson(request.getRings(), defaultRings()));
        if (request.getItems() != null) entity.setItems(toJson(request.getItems()));
        if (StringUtils.hasText(request.getStatus())) entity.setStatus(request.getStatus().toLowerCase());
        entity.setUpdatedAt(Instant.now());
        return toResponse(repository.save(entity));
    }

    @Transactional
    public void delete(UUID id) {
        TechnologyRadarEntity entity = findById(id);
        Instant now = Instant.now();
        entity.setDeletedAt(now);
        entity.setUpdatedAt(now);
        repository.save(entity);
    }

    public TechnologyRadarEntity findById(UUID id) {
        String tenantId = TenantContext.getOrDefault();
        return repository.findByIdAndDeletedAtIsNull(id)
                .filter(e -> e.getTenantId().equals(tenantId))
                .orElseThrow(() -> new EaException(ErrorCode.NOT_FOUND, "技术雷达不存在"));
    }

    private List<String> defaultQuadrants() {
        return List.of("语言与框架", "数据与存储", "平台与基础设施", "工具与流程");
    }

    private List<String> defaultRings() {
        return List.of("采纳", "试用", "评估", "暂缓");
    }

    private String toJson(Object value) {
        if (value == null) return "[]";
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException e) {
            throw new EaException(ErrorCode.INVALID_PARAM, "雷达数据序列化失败");
        }
    }

    private String toJson(List<?> value, List<?> defaultValue) {
        return toJson(value != null && !value.isEmpty() ? value : defaultValue);
    }

    private <T> List<T> fromJson(String json, TypeReference<List<T>> typeRef) {
        if (!StringUtils.hasText(json)) return List.of();
        try {
            return objectMapper.readValue(json, typeRef);
        } catch (JsonProcessingException e) {
            throw new EaException(ErrorCode.INTERNAL_ERROR, "雷达数据反序列化失败");
        }
    }

    private TechnologyRadarResponse toResponse(TechnologyRadarEntity entity) {
        return TechnologyRadarResponse.builder()
                .id(entity.getId())
                .tenantId(entity.getTenantId())
                .name(entity.getName())
                .quadrants(fromJson(entity.getQuadrants(), new TypeReference<>() {}))
                .rings(fromJson(entity.getRings(), new TypeReference<>() {}))
                .items(fromJson(entity.getItems(), new TypeReference<>() {}))
                .status(entity.getStatus())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }
}
