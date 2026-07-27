package com.metaplatform.obs.dashboard.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.obs.common.ErrorCode;
import com.metaplatform.obs.common.TenantContext;
import com.metaplatform.obs.dashboard.dto.DashboardExport;
import com.metaplatform.obs.dashboard.dto.DashboardRequest;
import com.metaplatform.obs.dashboard.entity.DashboardEntity;
import com.metaplatform.obs.dashboard.repository.DashboardRepository;
import com.metaplatform.obs.exception.ObsException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class DashboardService {

    private static final SecureRandom RANDOM = new SecureRandom();

    private final DashboardRepository dashboardRepository;
    private final ObjectMapper objectMapper;

    public DashboardEntity create(DashboardRequest request) {
        if (request == null || request.getTitle() == null || request.getTitle().isBlank()) {
            throw new ObsException(ErrorCode.MISSING_REQUIRED_FIELD, "title 不能为空");
        }
        DashboardEntity entity = DashboardEntity.builder()
                .tenantId(TenantContext.get())
                .title(request.getTitle())
                .description(request.getDescription())
                .layout(request.getLayout())
                .panels(request.getPanels())
                .isPublic(Boolean.TRUE.equals(request.getIsPublic()))
                .build();
        DashboardEntity saved = dashboardRepository.insert(entity);
        hydrate(saved);
        return saved;
    }

    public DashboardEntity update(UUID id, DashboardRequest request) {
        DashboardEntity existing = dashboardRepository.findById(id)
                .orElseThrow(() -> new ObsException(ErrorCode.LOG_NOT_FOUND, "仪表盘不存在: " + id));
        existing.setTitle(request.getTitle());
        existing.setDescription(request.getDescription());
        existing.setLayout(request.getLayout());
        existing.setPanels(request.getPanels());
        existing.setPublic(Boolean.TRUE.equals(request.getIsPublic()));
        DashboardEntity updated = dashboardRepository.update(existing);
        hydrate(updated);
        return updated;
    }

    public DashboardEntity get(UUID id) {
        DashboardEntity entity = dashboardRepository.findById(id)
                .orElseThrow(() -> new ObsException(ErrorCode.LOG_NOT_FOUND, "仪表盘不存在: " + id));
        hydrate(entity);
        return entity;
    }

    public List<DashboardEntity> list() {
        List<DashboardEntity> list = dashboardRepository.findAll(TenantContext.get());
        for (DashboardEntity entity : list) {
            hydrate(entity);
        }
        return list;
    }

    public void delete(UUID id) {
        DashboardEntity existing = dashboardRepository.findById(id)
                .orElseThrow(() -> new ObsException(ErrorCode.LOG_NOT_FOUND, "仪表盘不存在: " + id));
        int rows = dashboardRepository.softDelete(existing.getId());
        if (rows == 0) {
            throw new ObsException(ErrorCode.INTERNAL_ERROR, "删除仪表盘失败");
        }
    }

    public DashboardEntity generateShareToken(UUID id) {
        DashboardEntity existing = dashboardRepository.findById(id)
                .orElseThrow(() -> new ObsException(ErrorCode.LOG_NOT_FOUND, "仪表盘不存在: " + id));
        existing.setShareToken(generateToken());
        existing.setPublic(true);
        DashboardEntity updated = dashboardRepository.update(existing);
        hydrate(updated);
        return updated;
    }

    public DashboardEntity getByShareToken(String token) {
        if (token == null || token.isBlank()) {
            throw new ObsException(ErrorCode.MISSING_REQUIRED_FIELD, "shareToken 不能为空");
        }
        DashboardEntity entity = dashboardRepository.findByShareToken(token)
                .orElseThrow(() -> new ObsException(ErrorCode.LOG_NOT_FOUND, "分享链接无效或已撤销"));
        hydrate(entity);
        return entity;
    }

    public DashboardExport export(UUID id) {
        DashboardEntity entity = dashboardRepository.findById(id)
                .orElseThrow(() -> new ObsException(ErrorCode.LOG_NOT_FOUND, "仪表盘不存在: " + id));
        hydrate(entity);
        return DashboardExport.builder()
                .id(entity.getId())
                .title(entity.getTitle())
                .description(entity.getDescription())
                .layout(entity.getLayout())
                .panels(entity.getPanels())
                .exportedAt(Instant.now())
                .build();
    }

    private void hydrate(DashboardEntity entity) {
        String layoutRaw = dashboardRepository.getLayoutJson(entity.getId());
        if (layoutRaw != null) {
            try {
                entity.setLayout(objectMapper.readTree(layoutRaw));
            } catch (Exception e) {
                log.warn("Failed to parse layout, id={}", entity.getId());
            }
        }
        String panelsRaw = dashboardRepository.getPanelsJson(entity.getId());
        if (panelsRaw != null) {
            try {
                entity.setPanels(objectMapper.readTree(panelsRaw));
            } catch (Exception e) {
                log.warn("Failed to parse panels, id={}", entity.getId());
            }
        }
    }

    private String generateToken() {
        byte[] bytes = new byte[24];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
}