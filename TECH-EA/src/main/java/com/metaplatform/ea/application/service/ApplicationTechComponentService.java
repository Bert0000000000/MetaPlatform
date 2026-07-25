package com.metaplatform.ea.application.service;

import com.metaplatform.ea.application.dto.ApplicationTechComponentLinkResponse;
import com.metaplatform.ea.application.entity.ApplicationEntity;
import com.metaplatform.ea.application.entity.ApplicationTechComponentEntity;
import com.metaplatform.ea.application.repository.ApplicationRepository;
import com.metaplatform.ea.application.repository.ApplicationTechComponentRepository;
import com.metaplatform.ea.common.ErrorCode;
import com.metaplatform.ea.common.TenantContext;
import com.metaplatform.ea.exception.EaException;
import com.metaplatform.ea.techcomponent.entity.TechnologyComponentEntity;
import com.metaplatform.ea.techcomponent.repository.TechnologyComponentRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * 应用-技术组件关联服务。
 *
 * <p>支持正向（应用 → 技术组件）与反向（技术组件 → 应用）查询，
 * 替代 {@code ApplicationEntity.techStack} JSON 字符串存储的字符串包含匹配，
 * 用于影响分析与合规性评估的精确图遍历。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ApplicationTechComponentService {

    private static final String DEFAULT_RELATIONSHIP = "USES";

    private final ApplicationTechComponentRepository linkRepository;
    private final ApplicationRepository applicationRepository;
    private final TechnologyComponentRepository techComponentRepository;

    @Transactional
    public ApplicationTechComponentLinkResponse link(UUID applicationId,
                                                     UUID techComponentId,
                                                     String relationshipType) {
        String tenantId = TenantContext.getOrDefault();
        ensureApplicationExists(tenantId, applicationId);
        ensureTechComponentExists(tenantId, techComponentId);

        String rel = StringUtils.hasText(relationshipType) ? relationshipType.toUpperCase() : DEFAULT_RELATIONSHIP;

        if (linkRepository.existsByTenantIdAndApplicationIdAndTechComponentIdAndRelationshipTypeAndDeletedAtIsNull(
                tenantId, applicationId, techComponentId, rel)) {
            throw new EaException(ErrorCode.ALREADY_EXISTS, "应用-技术组件关联已存在");
        }

        Instant now = Instant.now();
        ApplicationTechComponentEntity entity = ApplicationTechComponentEntity.builder()
                .tenantId(tenantId)
                .applicationId(applicationId)
                .techComponentId(techComponentId)
                .relationshipType(rel)
                .createdAt(now)
                .updatedAt(now)
                .build();
        return toResponse(linkRepository.save(entity), null);
    }

    @Transactional
    public void unlink(UUID id) {
        String tenantId = TenantContext.getOrDefault();
        ApplicationTechComponentEntity entity = linkRepository.findByIdAndDeletedAtIsNull(id)
                .filter(e -> e.getTenantId().equals(tenantId))
                .orElseThrow(() -> new EaException(ErrorCode.NOT_FOUND, "关联记录不存在"));
        Instant now = Instant.now();
        entity.setDeletedAt(now);
        entity.setUpdatedAt(now);
        linkRepository.save(entity);
    }

    @Transactional(readOnly = true)
    public List<ApplicationTechComponentLinkResponse> findByApplicationId(UUID applicationId) {
        String tenantId = TenantContext.getOrDefault();
        ensureApplicationExists(tenantId, applicationId);
        List<ApplicationTechComponentEntity> links =
                linkRepository.findByTenantIdAndApplicationIdAndDeletedAtIsNull(tenantId, applicationId);
        Map<UUID, TechnologyComponentEntity> compMap = loadComponents(links);
        return links.stream().map(l -> toResponse(l, compMap.get(l.getTechComponentId()))).toList();
    }

    @Transactional(readOnly = true)
    public List<ApplicationTechComponentLinkResponse> findByTechComponentId(UUID techComponentId) {
        String tenantId = TenantContext.getOrDefault();
        ensureTechComponentExists(tenantId, techComponentId);
        List<ApplicationTechComponentEntity> links =
                linkRepository.findByTenantIdAndTechComponentIdAndDeletedAtIsNull(tenantId, techComponentId);
        Map<UUID, TechnologyComponentEntity> compMap = loadComponents(links);
        return links.stream().map(l -> toResponse(l, compMap.get(l.getTechComponentId()))).toList();
    }

    /**
     * 查找使用指定技术组件的应用 ID 列表（用于影响分析反向图遍历）。
     */
    @Transactional(readOnly = true)
    public List<UUID> findApplicationIdsByTechComponentId(UUID techComponentId) {
        String tenantId = TenantContext.getOrDefault();
        return linkRepository.findByTenantIdAndTechComponentIdAndDeletedAtIsNull(tenantId, techComponentId)
                .stream()
                .map(ApplicationTechComponentEntity::getApplicationId)
                .distinct()
                .toList();
    }

    /**
     * 查找指定应用使用的所有技术组件 ID 列表（替代 techStack JSON 字符串匹配）。
     */
    @Transactional(readOnly = true)
    public List<UUID> findTechComponentIdsByApplicationId(UUID applicationId) {
        String tenantId = TenantContext.getOrDefault();
        return linkRepository.findByTenantIdAndApplicationIdAndDeletedAtIsNull(tenantId, applicationId)
                .stream()
                .map(ApplicationTechComponentEntity::getTechComponentId)
                .distinct()
                .toList();
    }

    private void ensureApplicationExists(String tenantId, UUID applicationId) {
        ApplicationEntity app = applicationRepository.findByIdAndDeletedAtIsNull(applicationId)
                .orElseThrow(() -> new EaException(ErrorCode.NOT_FOUND, "应用不存在: " + applicationId));
        if (!app.getTenantId().equals(tenantId)) {
            throw new EaException(ErrorCode.PERMISSION_DENIED, "无权访问该应用");
        }
    }

    private void ensureTechComponentExists(String tenantId, UUID techComponentId) {
        TechnologyComponentEntity comp = techComponentRepository.findByIdAndDeletedAtIsNull(techComponentId)
                .orElseThrow(() -> new EaException(ErrorCode.NOT_FOUND, "技术组件不存在: " + techComponentId));
        if (!comp.getTenantId().equals(tenantId)) {
            throw new EaException(ErrorCode.PERMISSION_DENIED, "无权访问该技术组件");
        }
    }

    private Map<UUID, TechnologyComponentEntity> loadComponents(List<ApplicationTechComponentEntity> links) {
        if (links.isEmpty()) return Map.of();
        List<UUID> compIds = links.stream().map(ApplicationTechComponentEntity::getTechComponentId).distinct().toList();
        Map<UUID, TechnologyComponentEntity> map = new HashMap<>();
        for (UUID id : compIds) {
            techComponentRepository.findByIdAndDeletedAtIsNull(id).ifPresent(c -> map.put(id, c));
        }
        return map;
    }

    private ApplicationTechComponentLinkResponse toResponse(ApplicationTechComponentEntity entity,
                                                             TechnologyComponentEntity comp) {
        return ApplicationTechComponentLinkResponse.builder()
                .id(entity.getId())
                .tenantId(entity.getTenantId())
                .applicationId(entity.getApplicationId())
                .techComponentId(entity.getTechComponentId())
                .techComponentName(comp != null ? comp.getName() : null)
                .techComponentType(comp != null ? comp.getType() : null)
                .relationshipType(entity.getRelationshipType())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }
}
