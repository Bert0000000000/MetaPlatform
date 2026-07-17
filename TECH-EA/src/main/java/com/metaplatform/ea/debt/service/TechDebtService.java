package com.metaplatform.ea.debt.service;

import com.metaplatform.ea.application.entity.ApplicationEntity;
import com.metaplatform.ea.application.repository.ApplicationRepository;
import com.metaplatform.ea.common.ErrorCode;
import com.metaplatform.ea.common.TenantContext;
import com.metaplatform.ea.debt.dto.CreateTechDebtRequest;
import com.metaplatform.ea.debt.dto.TechDebtImpactResponse;
import com.metaplatform.ea.debt.dto.TechDebtResponse;
import com.metaplatform.ea.debt.dto.UpdateTechDebtRequest;
import com.metaplatform.ea.debt.entity.TechDebtEntity;
import com.metaplatform.ea.debt.repository.TechDebtRepository;
import com.metaplatform.ea.exception.EaException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class TechDebtService {

    private static final Set<String> ALLOWED_SEVERITIES = Set.of("LOW", "MEDIUM", "HIGH", "CRITICAL");
    private static final Set<String> ALLOWED_STATUSES = Set.of("OPEN", "IN_PROGRESS", "RESOLVED", "WONT_FIX");

    private final TechDebtRepository repository;
    private final ApplicationRepository applicationRepository;

    @Transactional
    public TechDebtResponse create(CreateTechDebtRequest request) {
        String tenantId = TenantContext.getOrDefault();
        if (repository.existsByTenantIdAndCodeAndDeletedAtIsNull(tenantId, request.getCode())) {
            throw new EaException(ErrorCode.ALREADY_EXISTS, "技术债编码已存在: " + request.getCode());
        }
        validateSeverity(request.getSeverity());
        validateStatus(request.getStatus());
        validateJson(request.getMetadata(), "metadata");
        validateScope(request);

        Instant now = Instant.now();
        TechDebtEntity entity = TechDebtEntity.builder()
                .tenantId(tenantId)
                .title(request.getTitle())
                .code(request.getCode())
                .category(request.getCategory())
                .severity(request.getSeverity() != null ? request.getSeverity().toUpperCase() : "MEDIUM")
                .status(request.getStatus() != null ? request.getStatus().toUpperCase() : "OPEN")
                .scopeType(request.getScopeType())
                .scopeId(request.getScopeId())
                .description(request.getDescription())
                .impactScore(request.getImpactScore() != null ? request.getImpactScore() : 0)
                .remediation(request.getRemediation())
                .estimatedEffort(request.getEstimatedEffort())
                .owner(request.getOwner())
                .metadata(normalizeJson(request.getMetadata(), "{}"))
                .createdAt(now)
                .updatedAt(now)
                .build();
        return toResponse(repository.save(entity));
    }

    @Transactional(readOnly = true)
    public List<TechDebtResponse> list(String severity, String scopeType, UUID scopeId) {
        String tenantId = TenantContext.getOrDefault();
        List<TechDebtEntity> items;
        if (scopeId != null && StringUtils.hasText(scopeType)) {
            items = repository.findByTenantIdAndScopeTypeAndScopeIdAndDeletedAtIsNull(tenantId, scopeType, scopeId);
        } else if (StringUtils.hasText(severity)) {
            items = repository.findByTenantIdAndSeverityAndDeletedAtIsNull(tenantId, severity.toUpperCase());
        } else {
            items = repository.findByTenantIdAndDeletedAtIsNull(tenantId);
        }
        return items.stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public TechDebtResponse get(UUID id) {
        return toResponse(findById(id));
    }

    @Transactional
    public TechDebtResponse update(UUID id, UpdateTechDebtRequest request) {
        TechDebtEntity entity = findById(id);
        if (StringUtils.hasText(request.getTitle())) entity.setTitle(request.getTitle());
        if (request.getCategory() != null) entity.setCategory(request.getCategory());
        if (StringUtils.hasText(request.getSeverity())) {
            validateSeverity(request.getSeverity());
            entity.setSeverity(request.getSeverity().toUpperCase());
        }
        if (StringUtils.hasText(request.getStatus())) {
            validateStatus(request.getStatus());
            entity.setStatus(request.getStatus().toUpperCase());
        }
        if (request.getDescription() != null) entity.setDescription(request.getDescription());
        if (request.getImpactScore() != null) entity.setImpactScore(request.getImpactScore());
        if (request.getRemediation() != null) entity.setRemediation(request.getRemediation());
        if (request.getEstimatedEffort() != null) entity.setEstimatedEffort(request.getEstimatedEffort());
        if (request.getOwner() != null) entity.setOwner(request.getOwner());
        if (request.getMetadata() != null) {
            validateJson(request.getMetadata(), "metadata");
            entity.setMetadata(normalizeJson(request.getMetadata(), "{}"));
        }
        entity.setUpdatedAt(Instant.now());
        return toResponse(repository.save(entity));
    }

    @Transactional
    public void delete(UUID id) {
        TechDebtEntity entity = findById(id);
        Instant now = Instant.now();
        entity.setDeletedAt(now);
        entity.setUpdatedAt(now);
        repository.save(entity);
    }

    @Transactional(readOnly = true)
    public TechDebtImpactResponse analyzeImpact(UUID id) {
        TechDebtEntity entity = findById(id);
        List<UUID> affectedApps = new ArrayList<>();
        if ("APPLICATION".equalsIgnoreCase(entity.getScopeType()) && entity.getScopeId() != null) {
            applicationRepository.findByIdAndDeletedAtIsNull(entity.getScopeId()).ifPresent(app -> {
                affectedApps.add(app.getId());
                affectedApps.addAll(collectDependents(app));
            });
        } else if ("TECH_STACK".equalsIgnoreCase(entity.getScopeType()) && entity.getScopeId() != null) {
            // Look for applications that reference this tech stack
            String tenantId = TenantContext.getOrDefault();
            for (ApplicationEntity app : applicationRepository.findByTenantIdAndDeletedAtIsNull(tenantId)) {
                affectedApps.add(app.getId());
            }
        }

        List<String> recommendations = new ArrayList<>();
        if ("CRITICAL".equalsIgnoreCase(entity.getSeverity())) {
            recommendations.add("建议立即制定修复计划");
            recommendations.add("在下一个迭代周期内处理");
        } else if ("HIGH".equalsIgnoreCase(entity.getSeverity())) {
            recommendations.add("建议在当前季度内修复");
        } else {
            recommendations.add("可在 backlog 中持续跟进");
        }
        if (affectedApps.size() > 5) {
            recommendations.add("影响面较大，修复时需考虑发布策略与兼容性");
        }

        return TechDebtImpactResponse.builder()
                .debtId(entity.getId())
                .code(entity.getCode())
                .severity(entity.getSeverity())
                .impactScore(entity.getImpactScore())
                .relatedOntologyConcepts(List.of())
                .affectedApplications(affectedApps)
                .recommendations(recommendations)
                .summary(String.format("技术债 [%s] 影响 %d 个应用", entity.getCode(), affectedApps.size()))
                .build();
    }

    private List<UUID> collectDependents(ApplicationEntity root) {
        String tenantId = TenantContext.getOrDefault();
        List<ApplicationEntity> all = applicationRepository.findByTenantIdAndDeletedAtIsNull(tenantId);
        List<UUID> deps = new ArrayList<>();
        for (ApplicationEntity app : all) {
            String json = app.getDependencies();
            if (json != null && json.contains(root.getId().toString())) {
                deps.add(app.getId());
            }
        }
        return deps;
    }

    public TechDebtEntity findById(UUID id) {
        String tenantId = TenantContext.getOrDefault();
        return repository.findByIdAndDeletedAtIsNull(id)
                .filter(e -> e.getTenantId().equals(tenantId))
                .orElseThrow(() -> new EaException(ErrorCode.NOT_FOUND, "技术债不存在"));
    }

    private void validateScope(CreateTechDebtRequest request) {
        if (request.getScopeId() != null && !StringUtils.hasText(request.getScopeType())) {
            throw new EaException(ErrorCode.INVALID_PARAM, "scopeType 与 scopeId 必须同时提供");
        }
        if (StringUtils.hasText(request.getScopeType()) && request.getScopeId() != null) {
            String scopeType = request.getScopeType().toUpperCase();
            if (!Set.of("APPLICATION", "TECH_STACK", "INFRASTRUCTURE", "DATA_ENTITY").contains(scopeType)) {
                throw new EaException(ErrorCode.INVALID_PARAM, "scopeType 必须为 APPLICATION/TECH_STACK/INFRASTRUCTURE/DATA_ENTITY");
            }
        }
    }

    private void validateSeverity(String severity) {
        if (severity == null) return;
        if (!ALLOWED_SEVERITIES.contains(severity.toUpperCase())) {
            throw new EaException(ErrorCode.INVALID_PARAM, "severity 必须为 LOW/MEDIUM/HIGH/CRITICAL");
        }
    }

    private void validateStatus(String status) {
        if (status == null) return;
        if (!ALLOWED_STATUSES.contains(status.toUpperCase())) {
            throw new EaException(ErrorCode.INVALID_PARAM, "status 必须为 OPEN/IN_PROGRESS/RESOLVED/WONT_FIX");
        }
    }

    private void validateJson(String value, String field) {
        if (value == null || value.isBlank()) return;
        try {
            objectMapper.readTree(value);
        } catch (Exception e) {
            throw new EaException(ErrorCode.INVALID_PARAM, field + " 不是合法的 JSON");
        }
    }

    private String normalizeJson(String value, String defaultValue) {
        if (value == null || value.isBlank()) return defaultValue;
        return value;
    }

    private TechDebtResponse toResponse(TechDebtEntity entity) {
        return TechDebtResponse.builder()
                .id(entity.getId())
                .tenantId(entity.getTenantId())
                .title(entity.getTitle())
                .code(entity.getCode())
                .category(entity.getCategory())
                .severity(entity.getSeverity())
                .status(entity.getStatus())
                .scopeType(entity.getScopeType())
                .scopeId(entity.getScopeId())
                .description(entity.getDescription())
                .impactScore(entity.getImpactScore())
                .remediation(entity.getRemediation())
                .estimatedEffort(entity.getEstimatedEffort())
                .owner(entity.getOwner())
                .metadata(entity.getMetadata())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }
}