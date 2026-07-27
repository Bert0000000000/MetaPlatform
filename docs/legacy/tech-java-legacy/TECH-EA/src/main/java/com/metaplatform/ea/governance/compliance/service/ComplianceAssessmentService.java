package com.metaplatform.ea.governance.compliance.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.ea.application.dto.ApplicationTechComponentLinkResponse;
import com.metaplatform.ea.application.entity.ApplicationEntity;
import com.metaplatform.ea.application.repository.ApplicationRepository;
import com.metaplatform.ea.application.service.ApplicationTechComponentService;
import com.metaplatform.ea.common.ErrorCode;
import com.metaplatform.ea.common.TenantContext;
import com.metaplatform.ea.exception.EaException;
import com.metaplatform.ea.governance.compliance.dto.ComplianceResult;
import com.metaplatform.ea.governance.compliance.dto.ComplianceViolation;
import com.metaplatform.ea.techcomponent.entity.TechnologyComponentEntity;
import com.metaplatform.ea.techcomponent.repository.TechnologyComponentRepository;
import com.metaplatform.ea.techradar.dto.TechnologyRadarItem;
import com.metaplatform.ea.techradar.dto.TechnologyRadarResponse;
import com.metaplatform.ea.techradar.service.TechnologyRadarService;
import com.metaplatform.ea.techstack.dto.TechnologyStackComponentRef;
import com.metaplatform.ea.techstack.entity.TechnologyStackEntity;
import com.metaplatform.ea.techstack.repository.TechnologyStackRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * 架构合规性自动评估服务。
 *
 * <p>规则示例：
 * <ul>
 *   <li>应用使用处于"暂缓"环的技术组件 → 违反"技术选型合规"原则 (TECH_STANDARD_COMPLIANCE)</li>
 *   <li>应用无文档（description 为空）→ 违反"文档完整性"原则 (DOC_COMPLETENESS)</li>
 *   <li>应用技术栈包含已弃用组件（status=deprecated）→ 违反"技术债管理"原则 (TECH_DEBT_MANAGEMENT)</li>
 * </ul>
 * 评估对照技术雷达 {@link TechnologyRadarService} 中的 items，按 name 匹配雷达条目的 ring。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ComplianceAssessmentService {

    private static final String RING_HOLD = "暂缓";
    private static final String STATUS_DEPRECATED = "deprecated";

    private static final String PRINCIPLE_TECH_STANDARD = "TECH_STANDARD_COMPLIANCE";
    private static final String PRINCIPLE_DOC_COMPLETENESS = "DOC_COMPLETENESS";
    private static final String PRINCIPLE_TECH_DEBT = "TECH_DEBT_MANAGEMENT";

    private final ApplicationRepository applicationRepository;
    private final ApplicationTechComponentService linkService;
    private final TechnologyComponentRepository techComponentRepository;
    private final TechnologyStackRepository techStackRepository;
    private final TechnologyRadarService radarService;
    private final ObjectMapper objectMapper;

    @Transactional(readOnly = true)
    public ComplianceResult assessApplication(UUID applicationId) {
        String tenantId = TenantContext.getOrDefault();
        ApplicationEntity app = applicationRepository.findByIdAndDeletedAtIsNull(applicationId)
                .filter(e -> e.getTenantId().equals(tenantId))
                .orElseThrow(() -> new EaException(ErrorCode.NOT_FOUND, "应用不存在: " + applicationId));

        List<ComplianceViolation> violations = new ArrayList<>();

        // 1. 通过关联表反查应用使用的技术组件
        List<ApplicationTechComponentLinkResponse> links = linkService.findByApplicationId(applicationId);
        Map<String, TechnologyRadarItem> radarMap = loadActiveRadarMap(tenantId);

        for (ApplicationTechComponentLinkResponse link : links) {
            TechnologyComponentEntity comp = techComponentRepository.findByIdAndDeletedAtIsNull(link.getTechComponentId())
                    .orElse(null);
            if (comp == null) continue;

            // 规则 a：技术组件在雷达中处于"暂缓"环 → 违反技术选型合规
            TechnologyRadarItem radarItem = matchRadarItem(radarMap, comp.getName());
            if (radarItem != null && RING_HOLD.equalsIgnoreCase(radarItem.getRing())) {
                violations.add(ComplianceViolation.builder()
                        .principleCode(PRINCIPLE_TECH_STANDARD)
                        .severity("ERROR")
                        .message(String.format("应用使用了处于暂缓环的技术组件：%s", comp.getName()))
                        .recommendation("请将 " + comp.getName() + " 替换为雷达中采纳/试用环的同类组件")
                        .evidence(String.format("component=%s, radarRing=%s", comp.getName(), radarItem.getRing()))
                        .build());
            }

            // 规则 b：技术组件状态为已弃用 → 违反技术债管理
            if (STATUS_DEPRECATED.equalsIgnoreCase(comp.getStatus())) {
                violations.add(ComplianceViolation.builder()
                        .principleCode(PRINCIPLE_TECH_DEBT)
                        .severity("WARNING")
                        .message(String.format("应用技术栈包含已弃用组件：%s", comp.getName()))
                        .recommendation("请制定 " + comp.getName() + " 的升级或替换计划")
                        .evidence(String.format("component=%s, status=%s", comp.getName(), comp.getStatus()))
                        .build());
            }
        }

        // 规则 c：应用无文档（description 为空）→ 违反文档完整性
        if (!StringUtils.hasText(app.getDescription())) {
            violations.add(ComplianceViolation.builder()
                    .principleCode(PRINCIPLE_DOC_COMPLETENESS)
                    .severity("INFO")
                    .message("应用缺少描述文档")
                    .recommendation("请补充应用的描述、责任人、文档链接等元数据")
                    .evidence("description is empty")
                    .build());
        }

        return buildResult("APPLICATION", app.getId(), app.getName(), violations);
    }

    @Transactional(readOnly = true)
    public ComplianceResult assessTechStack(UUID techStackId) {
        String tenantId = TenantContext.getOrDefault();
        TechnologyStackEntity stack = techStackRepository.findByIdAndDeletedAtIsNull(techStackId)
                .filter(e -> e.getTenantId().equals(tenantId))
                .orElseThrow(() -> new EaException(ErrorCode.NOT_FOUND, "技术栈画像不存在: " + techStackId));

        List<ComplianceViolation> violations = new ArrayList<>();
        Map<String, TechnologyRadarItem> radarMap = loadActiveRadarMap(tenantId);
        List<TechnologyStackComponentRef> components = parseComponentRefs(stack.getComponentRefs());

        for (TechnologyStackComponentRef ref : components) {
            TechnologyRadarItem radarItem = matchRadarItem(radarMap, ref.getComponentName());
            if (radarItem != null && RING_HOLD.equalsIgnoreCase(radarItem.getRing())) {
                violations.add(ComplianceViolation.builder()
                        .principleCode(PRINCIPLE_TECH_STANDARD)
                        .severity("ERROR")
                        .message(String.format("技术栈使用处于暂缓环的组件：%s", ref.getComponentName()))
                        .recommendation("请将 " + ref.getComponentName() + " 替换为采纳/试用环的同类组件")
                        .evidence(String.format("component=%s, radarRing=%s", ref.getComponentName(), radarItem.getRing()))
                        .build());
            }
        }

        return buildResult("TECH_STACK", stack.getId(), stack.getName(), violations);
    }

    private Map<String, TechnologyRadarItem> loadActiveRadarMap(String tenantId) {
        Map<String, TechnologyRadarItem> map = new HashMap<>();
        try {
            for (TechnologyRadarResponse radar : radarService.list()) {
                if (!"active".equalsIgnoreCase(radar.getStatus())) continue;
                if (radar.getItems() == null) continue;
                for (TechnologyRadarItem item : radar.getItems()) {
                    if (item.getName() != null) {
                        map.putIfAbsent(item.getName().toLowerCase(), item);
                    }
                }
            }
        } catch (Exception e) {
            log.warn("Failed to load technology radar for tenant {}", tenantId, e);
        }
        return map;
    }

    private TechnologyRadarItem matchRadarItem(Map<String, TechnologyRadarItem> radarMap, String componentName) {
        if (componentName == null) return null;
        return radarMap.get(componentName.toLowerCase());
    }

    private List<TechnologyStackComponentRef> parseComponentRefs(String json) {
        if (!StringUtils.hasText(json)) return List.of();
        try {
            return objectMapper.readValue(json, new TypeReference<>() {});
        } catch (Exception e) {
            log.warn("Failed to parse component_refs: {}", json, e);
            return List.of();
        }
    }

    private ComplianceResult buildResult(String targetType, UUID targetId, String targetName,
                                          List<ComplianceViolation> violations) {
        boolean passed = violations.isEmpty();
        String summary = String.format("评估目标 %s[%s] 共发现 %d 项违规，%s",
                targetType, targetName, violations.size(), passed ? "通过合规评估" : "存在违规需处理");
        return ComplianceResult.builder()
                .targetType(targetType)
                .targetId(targetId)
                .targetName(targetName)
                .passed(passed)
                .violations(violations)
                .assessedAt(Instant.now())
                .summary(summary)
                .build();
    }
}
