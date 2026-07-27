package com.metaplatform.wfe.apphub.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.wfe.apphub.dto.AppVersionCreateRequest;
import com.metaplatform.wfe.apphub.dto.AppVersionResponse;
import com.metaplatform.wfe.apphub.entity.AppVersionEntity;
import com.metaplatform.wfe.apphub.entity.AppVersionStatus;
import com.metaplatform.wfe.apphub.repository.AppVersionRepository;
import com.metaplatform.wfe.common.ErrorCode;
import com.metaplatform.wfe.common.PageResponse;
import com.metaplatform.wfe.common.TenantContext;
import com.metaplatform.wfe.common.TraceContext;
import com.metaplatform.wfe.exception.WfeException;
import com.metaplatform.wfe.service.WfeOutboxService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * 应用版本管理服务（V11-08）：
 *   - 创建/查询/发布/回滚/删除应用版本快照
 *   - 回滚操作在事务内创建一条新版本（状态 ROLLBACK）并发布 APP_VERSION_ROLLBACK 事件
 *   - 通过 Outbox 模式保证事件不丢失，trace_id 通过 TraceContext 注入
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AppVersionService {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    private final AppVersionRepository appVersionRepository;
    private final WfeOutboxService wfeOutboxService;

    @Transactional
    public AppVersionResponse create(AppVersionCreateRequest request) {
        String tenantId = TenantContext.get();
        String userId = TenantContext.getUserId();
        if (appVersionRepository.existsByTenantIdAndAppIdAndVersion(
                tenantId, request.getAppId(), request.getVersion())) {
            throw new WfeException(ErrorCode.APP_VERSION_STATUS_CONFLICT,
                    "版本号已存在: appId=" + request.getAppId() + ", version=" + request.getVersion());
        }
        Instant now = Instant.now();
        AppVersionEntity entity = AppVersionEntity.builder()
                .id(UUID.randomUUID().toString())
                .tenantId(tenantId)
                .appId(request.getAppId())
                .version(request.getVersion())
                .changeLog(request.getChangeLog())
                .snapshot(request.getSnapshot())
                .status(AppVersionStatus.DRAFT)
                .createdBy(userId)
                .build();
        AppVersionEntity saved = appVersionRepository.save(entity);
        publishOutboxEvent(tenantId, saved.getId(), "APP_VERSION_CREATED", Map.of(
                "appId", saved.getAppId(), "version", saved.getVersion()));
        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public PageResponse<AppVersionResponse> list(String appId, int page, int size) {
        String tenantId = TenantContext.get();
        PageRequest pageRequest = PageRequest.of(Math.max(0, page - 1), Math.max(1, size),
                Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<AppVersionEntity> result = appVersionRepository
                .findByTenantIdAndAppIdOrderByCreatedAtDesc(tenantId, appId, pageRequest);
        return PageResponse.<AppVersionResponse>builder()
                .items(result.getContent().stream().map(this::toResponse).toList())
                .total(result.getTotalElements())
                .page(page)
                .pageSize(size)
                .totalPages(result.getTotalPages())
                .build();
    }

    @Transactional(readOnly = true)
    public AppVersionResponse get(String versionId) {
        return toResponse(findById(versionId));
    }

    @Transactional
    public AppVersionResponse publish(String versionId) {
        AppVersionEntity entity = findById(versionId);
        if (entity.getStatus() == AppVersionStatus.PUBLISHED) {
            throw new WfeException(ErrorCode.APP_VERSION_STATUS_CONFLICT,
                    "版本已发布，无法重复发布: " + versionId);
        }
        if (entity.getStatus() == AppVersionStatus.OFFLINE) {
            throw new WfeException(ErrorCode.APP_VERSION_STATUS_CONFLICT,
                    "已下线的版本不可发布: " + versionId);
        }
        // 将同 app 的其它 PUBLISHED 版本置为 OFFLINE（保证同一应用仅一个发布版本）
        appVersionRepository
                .findFirstByTenantIdAndAppIdAndStatusOrderByCreatedAtDesc(
                        entity.getTenantId(), entity.getAppId(), AppVersionStatus.PUBLISHED)
                .ifPresent(current -> {
                    current.setStatus(AppVersionStatus.OFFLINE);
                    appVersionRepository.save(current);
                });
        entity.setStatus(AppVersionStatus.PUBLISHED);
        entity.setPublishedBy(TenantContext.getUserId());
        entity.setPublishedAt(Instant.now());
        AppVersionEntity saved = appVersionRepository.save(entity);
        publishOutboxEvent(entity.getTenantId(), saved.getId(), "APP_VERSION_PUBLISHED", Map.of(
                "appId", saved.getAppId(), "version", saved.getVersion()));
        return toResponse(saved);
    }

    /**
     * 版本回滚（事务保证）：基于指定历史版本创建一条新的 ROLLBACK 版本快照，
     * 同时将当前 PUBLISHED 版本下线。返回新创建的回滚版本。
     */
    @Transactional
    public AppVersionResponse rollback(String versionId) {
        AppVersionEntity source = findById(versionId);
        if (source.getStatus() != AppVersionStatus.PUBLISHED
                && source.getStatus() != AppVersionStatus.OFFLINE) {
            throw new WfeException(ErrorCode.APP_VERSION_STATUS_CONFLICT,
                    "仅已发布或已下线的版本可回滚: " + versionId);
        }
        String tenantId = source.getTenantId();
        // 下线当前 PUBLISHED 版本
        appVersionRepository
                .findFirstByTenantIdAndAppIdAndStatusOrderByCreatedAtDesc(
                        tenantId, source.getAppId(), AppVersionStatus.PUBLISHED)
                .ifPresent(current -> {
                    current.setStatus(AppVersionStatus.OFFLINE);
                    appVersionRepository.save(current);
                });
        String rollbackVersion = "rb-" + System.currentTimeMillis();
        Instant now = Instant.now();
        AppVersionEntity rollbackEntity = AppVersionEntity.builder()
                .id(UUID.randomUUID().toString())
                .tenantId(tenantId)
                .appId(source.getAppId())
                .version(rollbackVersion)
                .changeLog("回滚至版本 " + source.getVersion())
                .snapshot(source.getSnapshot())
                .status(AppVersionStatus.ROLLBACK)
                .rolledBackBy(TenantContext.getUserId())
                .rolledBackAt(now)
                .createdBy(TenantContext.getUserId())
                .build();
        AppVersionEntity saved = appVersionRepository.save(rollbackEntity);
        Map<String, Object> payload = new HashMap<>();
        payload.put("appId", saved.getAppId());
        payload.put("sourceVersionId", source.getId());
        payload.put("rollbackVersionId", saved.getId());
        publishOutboxEvent(tenantId, saved.getId(), "APP_VERSION_ROLLBACK", payload);
        return toResponse(saved);
    }

    @Transactional
    public void delete(String versionId) {
        AppVersionEntity entity = findById(versionId);
        if (entity.getStatus() == AppVersionStatus.PUBLISHED) {
            throw new WfeException(ErrorCode.APP_VERSION_STATUS_CONFLICT,
                    "已发布的版本不可删除: " + versionId);
        }
        appVersionRepository.delete(entity);
        publishOutboxEvent(entity.getTenantId(), entity.getId(), "APP_VERSION_DELETED", Map.of(
                "appId", entity.getAppId(), "version", entity.getVersion()));
    }

    private AppVersionEntity findById(String versionId) {
        return appVersionRepository
                .findByIdAndTenantId(versionId, TenantContext.get())
                .orElseThrow(() -> new WfeException(ErrorCode.APP_VERSION_NOT_FOUND,
                        "应用版本不存在: " + versionId));
    }

    private AppVersionResponse toResponse(AppVersionEntity entity) {
        return AppVersionResponse.builder()
                .versionId(entity.getId())
                .appId(entity.getAppId())
                .version(entity.getVersion())
                .status(entity.getStatus().name())
                .changeLog(entity.getChangeLog())
                .snapshot(entity.getSnapshot())
                .publishedBy(entity.getPublishedBy())
                .publishedAt(entity.getPublishedAt())
                .rolledBackBy(entity.getRolledBackBy())
                .rolledBackAt(entity.getRolledBackAt())
                .createdBy(entity.getCreatedBy())
                .createdAt(entity.getCreatedAt())
                .build();
    }

    private void publishOutboxEvent(String tenantId, String aggregateId, String eventType, Object payload) {
        try {
            Map<String, String> headers = new HashMap<>();
            headers.put(TraceContext.TRACE_ID_HEADER, TraceContext.getOrCreate());
            wfeOutboxService.publishEvent(tenantId, aggregateId, eventType, payload, headers);
        } catch (Exception e) {
            log.warn("Failed to publish {} event (non-blocking): aggregateId={}, error={}",
                    eventType, aggregateId, e.getMessage());
        }
    }

    /**
     * 解析版本快照为 JSON 对象（供版本对比使用）。
     */
    public Map<String, Object> parseSnapshot(String snapshot) {
        try {
            return OBJECT_MAPPER.readValue(snapshot, new TypeReference<>() {});
        } catch (Exception e) {
            log.warn("Failed to parse snapshot: {}", e.getMessage());
            return Map.of();
        }
    }

    /**
     * 版本对比：返回字段 added/removed/modified。
     */
    public Map<String, List<String>> compare(String versionIdA, String versionIdB) {
        AppVersionEntity a = findById(versionIdA);
        AppVersionEntity b = findById(versionIdB);
        Map<String, Object> aObj = parseSnapshot(a.getSnapshot());
        Map<String, Object> bObj = parseSnapshot(b.getSnapshot());
        List<String> added = bObj.keySet().stream().filter(k -> !aObj.containsKey(k)).toList();
        List<String> removed = aObj.keySet().stream().filter(k -> !bObj.containsKey(k)).toList();
        List<String> modified = bObj.keySet().stream()
                .filter(aObj::containsKey)
                .filter(k -> !String.valueOf(aObj.get(k)).equals(String.valueOf(bObj.get(k))))
                .toList();
        return Map.of("added", added, "removed", removed, "modified", modified);
    }
}
