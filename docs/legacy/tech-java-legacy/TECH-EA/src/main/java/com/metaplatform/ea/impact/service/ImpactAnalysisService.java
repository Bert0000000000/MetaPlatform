package com.metaplatform.ea.impact.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.ea.application.entity.ApplicationEntity;
import com.metaplatform.ea.application.repository.ApplicationRepository;
import com.metaplatform.ea.capability.entity.BusinessCapabilityEntity;
import com.metaplatform.ea.capability.repository.BusinessCapabilityRepository;
import com.metaplatform.ea.common.ErrorCode;
import com.metaplatform.ea.common.TenantContext;
import com.metaplatform.ea.exception.EaException;
import com.metaplatform.ea.impact.dto.ImpactAnalysisResponse;
import com.metaplatform.ea.mapping.entity.CapabilityConceptMappingEntity;
import com.metaplatform.ea.mapping.repository.CapabilityConceptMappingRepository;
import com.metaplatform.ea.process.entity.BusinessProcessEntity;
import com.metaplatform.ea.process.repository.BusinessProcessRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
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
 * 应用通过 {@code ea_application.capability_ids} JSONB 字段关联，业务流程通过
 * {@code ea_business_process.capabilities} JSONB 字段关联，二者均以 UUID 字符串形式存储。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ImpactAnalysisService {

    private static final int HIGH_RISK_THRESHOLD = 10;
    private static final int MEDIUM_RISK_THRESHOLD = 3;

    private final BusinessCapabilityRepository capabilityRepository;
    private final CapabilityConceptMappingRepository mappingRepository;
    private final ApplicationRepository applicationRepository;
    private final BusinessProcessRepository processRepository;
    private final ObjectMapper objectMapper;

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

        // 3. 受影响应用：通过 ApplicationEntity.capabilityIds JSONB 反查
        Set<String> affectedCapabilityStr = new HashSet<>();
        for (UUID id : affectedCapabilityIds) {
            affectedCapabilityStr.add(id.toString());
        }
        List<String> affectedApplications = new ArrayList<>();
        for (ApplicationEntity app : applicationRepository.findByTenantIdAndDeletedAtIsNull(tenantId)) {
            List<String> caps = app.getCapabilityIds() == null
                    ? List.of() : new ArrayList<>(app.getCapabilityIds().keySet());
            for (String capId : caps) {
                if (affectedCapabilityStr.contains(capId)) {
                    affectedApplications.add(app.getId().toString());
                    break;
                }
            }
        }

        // 4. 受影响业务流程：通过 BusinessProcessEntity.capabilities JSONB 反查
        List<String> affectedProcesses = new ArrayList<>();
        for (BusinessProcessEntity process : processRepository.findByTenantIdAndDeletedAtIsNull(tenantId)) {
            List<String> caps = readStringList(process.getCapabilities());
            for (String capId : caps) {
                if (affectedCapabilityStr.contains(capId)) {
                    affectedProcesses.add(process.getId().toString());
                    break;
                }
            }
        }

        // 5. 风险评级：综合子能力数 + 映射数 + 受影响应用/流程
        int totalImpact = affectedCapabilityIds.size() + mappings.size()
                + affectedApplications.size() + affectedProcesses.size();
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

    private List<String> readStringList(String json) {
        if (json == null || json.isBlank()) return List.of();
        try {
            return objectMapper.readValue(json, new TypeReference<>() {});
        } catch (Exception e) {
            log.warn("Failed to parse capability JSON list: {}", json, e);
            return List.of();
        }
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
