package com.metaplatform.wfe.apphub.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.wfe.apphub.dto.TemplateCommentRequest;
import com.metaplatform.wfe.apphub.dto.TemplateCommentResponse;
import com.metaplatform.wfe.apphub.dto.TemplateInstallResponse;
import com.metaplatform.wfe.apphub.dto.TemplateResponse;
import com.metaplatform.wfe.apphub.entity.TemplateCommentEntity;
import com.metaplatform.wfe.apphub.entity.TemplateEntity;
import com.metaplatform.wfe.apphub.entity.TemplateInstallEntity;
import com.metaplatform.wfe.apphub.repository.TemplateCommentRepository;
import com.metaplatform.wfe.apphub.repository.TemplateInstallRepository;
import com.metaplatform.wfe.apphub.repository.TemplateRepository;
import com.metaplatform.wfe.common.ErrorCode;
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
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * 市场模板服务（V11-08）：模板列表、详情、安装、评分评论。
 *   - 安装链路：先校验是否重复安装，再创建安装记录并自增模板下载量
 *   - 评分评论：同一用户对同一模板仅保留最新一条，提交后重新计算模板的平均评分
 *   - 所有写操作通过 Outbox 模式发布事件，trace_id 全链路传播
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class TemplateService {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
    private static final List<String> SYSTEM_TENANTS = List.of(TenantContext.DEFAULT_TENANT_ID);

    private final TemplateRepository templateRepository;
    private final TemplateInstallRepository installRepository;
    private final TemplateCommentRepository commentRepository;
    private final WfeOutboxService wfeOutboxService;

    @Transactional(readOnly = true)
    public List<TemplateResponse> list(String keyword, String category) {
        // 模板市场默认返回系统租户（DEFAULT_TENANT_ID）下发布的模板
        PageRequest pageRequest = PageRequest.of(0, 200, Sort.by(Sort.Direction.DESC, "downloadCount"));
        Page<TemplateEntity> page;
        boolean hasKeyword = keyword != null && !keyword.isBlank();
        boolean hasCategory = category != null && !category.isBlank();
        for (String tenant : SYSTEM_TENANTS) {
            if (hasCategory && hasKeyword) {
                page = templateRepository.findByTenantIdAndCategoryAndNameContaining(tenant, category, keyword, pageRequest);
            } else if (hasCategory) {
                page = templateRepository.findByTenantIdAndCategory(tenant, category, pageRequest);
            } else if (hasKeyword) {
                page = templateRepository.findByTenantIdAndNameContaining(tenant, keyword, pageRequest);
            } else {
                page = templateRepository.findByTenantId(tenant, pageRequest);
            }
            if (!page.isEmpty()) {
                return page.getContent().stream().map(this::toResponse).toList();
            }
        }
        return Collections.emptyList();
    }

    @Transactional(readOnly = true)
    public TemplateResponse get(String templateId) {
        return toResponse(findById(templateId));
    }

    @Transactional
    public TemplateInstallResponse install(String templateId) {
        String tenantId = TenantContext.get();
        TemplateEntity template = findById(templateId);
        if (installRepository.findByTenantIdAndTemplateId(tenantId, templateId).isPresent()) {
            throw new WfeException(ErrorCode.TEMPLATE_ALREADY_INSTALLED,
                    "模板已安装过: " + templateId);
        }
        // 生成新的应用 ID（此处仅生成标识，真正的应用创建由 APP-APPHUB 读取 configSnapshot 完成）
        String appId = "app-" + UUID.randomUUID().toString().substring(0, 8);
        TemplateInstallEntity install = TemplateInstallEntity.builder()
                .id(UUID.randomUUID().toString())
                .tenantId(tenantId)
                .templateId(templateId)
                .appId(appId)
                .installedBy(TenantContext.getUserId())
                .build();
        installRepository.save(install);
        // 自增下载量
        template.setDownloadCount((template.getDownloadCount() == null ? 0L : template.getDownloadCount()) + 1L);
        templateRepository.save(template);

        Map<String, Object> payload = new HashMap<>();
        payload.put("templateId", templateId);
        payload.put("appId", appId);
        payload.put("installedBy", install.getInstalledBy());
        publishOutboxEvent(template.getTenantId(), templateId, "TEMPLATE_INSTALLED", payload);

        return TemplateInstallResponse.builder()
                .success(true)
                .appId(appId)
                .templateId(templateId)
                .build();
    }

    @Transactional(readOnly = true)
    public List<TemplateCommentResponse> listComments(String templateId, int page, int size) {
        String tenantId = TenantContext.get();
        PageRequest pageRequest = PageRequest.of(Math.max(0, page - 1), Math.max(1, size),
                Sort.by(Sort.Direction.DESC, "updatedAt"));
        Page<TemplateCommentEntity> result = commentRepository
                .findByTenantIdAndTemplateIdOrderByUpdatedAtDesc(tenantId, templateId, pageRequest);
        return result.getContent().stream().map(this::toCommentResponse).toList();
    }

    @Transactional
    public TemplateCommentResponse addOrUpdateComment(String templateId, TemplateCommentRequest request) {
        String tenantId = TenantContext.get();
        String userId = TenantContext.getUserId();
        if (userId == null) {
            throw new WfeException(ErrorCode.UNAUTHORIZED, "未识别用户，无法提交评分");
        }
        // 校验模板存在
        findById(templateId);
        TemplateCommentEntity entity = commentRepository
                .findByTenantIdAndTemplateIdAndUserId(tenantId, templateId, userId)
                .orElseGet(() -> TemplateCommentEntity.builder()
                        .id(UUID.randomUUID().toString())
                        .tenantId(tenantId)
                        .templateId(templateId)
                        .userId(userId)
                        .build());
        entity.setRating(request.getRating());
        entity.setComment(request.getComment());
        entity.setUpdatedAt(Instant.now());
        TemplateCommentEntity saved = commentRepository.save(entity);
        // 重新计算模板平均评分
        recalculateRating(templateId);
        publishOutboxEvent(tenantId, templateId, "TEMPLATE_RATED", Map.of(
                "userId", userId, "rating", request.getRating()));
        return toCommentResponse(saved);
    }

    private void recalculateRating(String templateId) {
        try {
            Object[] stats = commentRepository.sumRatingAndCount(TenantContext.get(), templateId);
            if (stats == null || stats.length < 2) return;
            Long sum = ((Number) stats[0]).longValue();
            Long count = ((Number) stats[1]).longValue();
            TemplateEntity template = findById(templateId);
            template.setRatingSum(sum);
            template.setRatingCount(count);
            templateRepository.save(template);
        } catch (Exception e) {
            log.warn("Failed to recalculate rating for template {}: {}", templateId, e.getMessage());
        }
    }

    private TemplateEntity findById(String templateId) {
        for (String tenant : SYSTEM_TENANTS) {
            var opt = templateRepository.findByTenantIdAndTemplateId(tenant, templateId);
            if (opt.isPresent()) return opt.get();
        }
        throw new WfeException(ErrorCode.TEMPLATE_NOT_FOUND, "模板不存在: " + templateId);
    }

    private TemplateResponse toResponse(TemplateEntity entity) {
        Double avgRating = entity.getRatingCount() == null || entity.getRatingCount() == 0
                ? 0.0 : Math.round(entity.getRatingSum() * 10.0 / entity.getRatingCount()) / 10.0;
        return TemplateResponse.builder()
                .templateId(entity.getTemplateId())
                .name(entity.getName())
                .category(entity.getCategory())
                .description(entity.getDescription())
                .icon(entity.getIcon())
                .tags(parseTags(entity.getTags()))
                .downloadCount(entity.getDownloadCount())
                .rating(avgRating)
                .ratingCount(entity.getRatingCount())
                .preview(entity.getPreview())
                .configSnapshot(entity.getConfigSnapshot())
                .createdAt(entity.getCreatedAt())
                .build();
    }

    private TemplateCommentResponse toCommentResponse(TemplateCommentEntity entity) {
        return TemplateCommentResponse.builder()
                .id(entity.getId())
                .templateId(entity.getTemplateId())
                .userId(entity.getUserId())
                .rating(entity.getRating())
                .comment(entity.getComment())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }

    private List<String> parseTags(String tags) {
        if (tags == null || tags.isBlank()) return Collections.emptyList();
        try {
            return OBJECT_MAPPER.readValue(tags, new TypeReference<>() {});
        } catch (Exception e) {
            return List.of(tags.split(","));
        }
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
}
