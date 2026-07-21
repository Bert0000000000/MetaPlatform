package com.metaplatform.ea.impact.service;

import com.metaplatform.ea.capability.entity.BusinessCapabilityEntity;
import com.metaplatform.ea.capability.repository.BusinessCapabilityRepository;
import com.metaplatform.ea.common.ErrorCode;
import com.metaplatform.ea.common.TenantContext;
import com.metaplatform.ea.exception.EaException;
import com.metaplatform.ea.impact.dto.ImpactAnalysisResponse;
import com.metaplatform.ea.mapping.entity.CapabilityConceptMappingEntity;
import com.metaplatform.ea.mapping.repository.CapabilityConceptMappingRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * 能力影响分析服务。
 *
 * <p>聚合能力子树、关联本体概念映射、引用该能力的应用与业务流程，输出风险等级。
 * 当前版本以能力子树 + 映射数量作为风险评级主要依据，applications/processes 关联
 * 留待后续补充（依赖 ApplicationEntity / BusinessProcessEntity 与 capability 的关联表）。
 */
@Service
@RequiredArgsConstructor
public class ImpactAnalysisService {

    private static final int HIGH_RISK_THRESHOLD = 10;
    private static final int MEDIUM_RISK_THRESHOLD = 3;

    private final BusinessCapabilityRepository capabilityRepository;
    private final CapabilityConceptMappingRepository mappingRepository;

    @Transactional(readOnly = true)
    public ImpactAnalysisResponse analyze(String capabilityIdRaw) {
        UUID capabilityId = parseCapabilityId(capabilityIdRaw);
        String tenantId = TenantContext.getOrDefault();

        BusinessCapabilityEntity root = capabilityRepository
                .findByIdAndTenantIdAndDeletedAtIsNull(capabilityId, tenantId)
                .orElseThrow(() -> new EaException(ErrorCode.NOT_FOUND,
                        "能力不存在: " + capabilityId));

        // 1. 收集受影响能力（自身 + 直接子节点）
        Set<UUID> affectedCapabilityIds = new HashSet<>();
        affectedCapabilityIds.add(root.getId());
        List<BusinessCapabilityEntity> children = capabilityRepository
                .findByTenantIdAndParentIdAndDeletedAtIsNull(tenantId, capabilityId);
        for (BusinessCapabilityEntity child : children) {
            affectedCapabilityIds.add(child.getId());
        }

        // 2. 统计与该能力关联的本体概念映射数
        List<CapabilityConceptMappingEntity> mappings = mappingRepository
                .findByTenantIdAndCapabilityIdAndDeletedAtIsNull(tenantId, capabilityId);

        // 3. 受影响应用/流程（占位，待 ApplicationEntity / BusinessProcessEntity 关联补全）
        List<String> affectedApplications = new ArrayList<>();
        List<String> affectedProcesses = new ArrayList<>();

        // 4. 风险评级：综合子能力数 + 映射数
        int totalImpact = affectedCapabilityIds.size() + mappings.size();
        String riskLevel;
        if (totalImpact >= HIGH_RISK_THRESHOLD) {
            riskLevel = "high";
        } else if (totalImpact >= MEDIUM_RISK_THRESHOLD) {
            riskLevel = "medium";
        } else {
            riskLevel = "low";
        }

        String summary = String.format(
                "能力 [%s] 影响范围：子能力 %d 个、本体映射 %d 条、应用 %d 个、流程 %d 个，风险等级 %s",
                root.getCode(),
                affectedCapabilityIds.size(),
                mappings.size(),
                affectedApplications.size(),
                affectedProcesses.size(),
                riskLevel
        );

        return ImpactAnalysisResponse.builder()
                .affectedCapabilities(affectedCapabilityIds.stream().map(UUID::toString).toList())
                .affectedApplications(affectedApplications)
                .affectedProcesses(affectedProcesses)
                .riskLevel(riskLevel)
                .summary(summary)
                .build();
    }

    private UUID parseCapabilityId(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new EaException(ErrorCode.INVALID_PARAM, "capabilityId 不能为空");
        }
        try {
            return UUID.fromString(raw.trim());
        } catch (IllegalArgumentException ex) {
            throw new EaException(ErrorCode.INVALID_PARAM, "capabilityId 格式非法: " + raw);
        }
    }
}
