package com.metaplatform.mcp.permission.service;

import com.metaplatform.mcp.common.ErrorCode;
import com.metaplatform.mcp.common.PageResponse;
import com.metaplatform.mcp.common.TenantContext;
import com.metaplatform.mcp.exception.McpException;
import com.metaplatform.mcp.permission.dto.*;
import com.metaplatform.mcp.permission.entity.McpPermissionRuleEntity;
import com.metaplatform.mcp.permission.repository.McpPermissionRuleRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

/**
 * MCP 权限规则服务：CRUD + 矩阵 + 检查。
 *
 * 权限评估算法（与 PRD REQ-3.6 对齐）：
 * 1. 候选规则 = tenantId 匹配 + subjectId 匹配 + resourceType 匹配 + (resourceId 通配 OR 精确匹配)
 * 2. 动作匹配 = 规则 actions（逗号分隔）包含请求 action
 * 3. 按 priority 降序取最高优先级组
 * 4. 同组内 DENY 优先于 ALLOW
 * 5. 无匹配默认 DENY
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class McpPermissionService {

    private static final String EFFECT_ALLOW = "ALLOW";
    private static final String EFFECT_DENY = "DENY";
    private static final String DEFAULT_ACTION_FOR_MATRIX = "execute";
    private static final String SUBJECT_TYPE_EXTERNAL_APP = "EXTERNAL_APP";

    private final McpPermissionRuleRepository repository;

    // ==================== CRUD ====================

    @Transactional
    public PermissionRuleResponse create(CreatePermissionRuleRequest request) {
        String tenantId = TenantContext.getOrDefault();
        String ruleId = UUID.randomUUID().toString();
        McpPermissionRuleEntity entity = McpPermissionRuleEntity.builder()
                .tenantId(tenantId)
                .ruleId(ruleId)
                .name(request.name())
                .subjectType(request.subjectType().toUpperCase())
                .subjectId(request.subjectId())
                .resourceType(request.resourceType().toUpperCase())
                .resourceId(request.resourceId())
                .actions(normalizeActions(request.actions()))
                .effect(request.effect().toUpperCase())
                .priority(request.priority() == null ? 0 : request.priority())
                .enabled(request.enabled() == null ? Boolean.TRUE : request.enabled())
                .build();
        repository.save(entity);
        log.info("Permission rule created, tenantId={}, ruleId={}, name={}", tenantId, ruleId, request.name());
        return toResponse(entity);
    }

    @Transactional(readOnly = true)
    public PageResponse<PermissionRuleResponse> list(String subjectId, String resourceType, Integer page, Integer size) {
        String tenantId = TenantContext.getOrDefault();
        int p = page == null || page < 1 ? 1 : page;
        int s = size == null || size < 1 ? 20 : Math.min(size, 100);
        Pageable pageable = PageRequest.of(p - 1, s);
        Page<McpPermissionRuleEntity> result = repository.search(tenantId, subjectId, resourceType, pageable);
        return PageResponse.<PermissionRuleResponse>builder()
                .items(result.getContent().stream().map(this::toResponse).toList())
                .total(result.getTotalElements())
                .page(p)
                .size(s)
                .totalPages(result.getTotalPages())
                .build();
    }

    @Transactional(readOnly = true)
    public PermissionRuleResponse get(String ruleId) {
        return toResponse(findById(ruleId));
    }

    @Transactional
    public PermissionRuleResponse update(String ruleId, UpdatePermissionRuleRequest request) {
        McpPermissionRuleEntity entity = findById(ruleId);
        if (request.name() != null) {
            entity.setName(request.name());
        }
        if (request.subjectType() != null) {
            entity.setSubjectType(request.subjectType().toUpperCase());
        }
        if (request.subjectId() != null) {
            entity.setSubjectId(request.subjectId());
        }
        if (request.resourceType() != null) {
            entity.setResourceType(request.resourceType().toUpperCase());
        }
        if (request.resourceId() != null) {
            entity.setResourceId(request.resourceId());
        }
        if (request.actions() != null) {
            entity.setActions(normalizeActions(request.actions()));
        }
        if (request.effect() != null) {
            entity.setEffect(request.effect().toUpperCase());
        }
        if (request.priority() != null) {
            entity.setPriority(request.priority());
        }
        if (request.enabled() != null) {
            entity.setEnabled(request.enabled());
        }
        repository.save(entity);
        return toResponse(entity);
    }

    @Transactional
    public void delete(String ruleId) {
        String tenantId = TenantContext.getOrDefault();
        long deleted = repository.deleteByTenantIdAndRuleId(tenantId, ruleId);
        if (deleted == 0) {
            throw new McpException(ErrorCode.PERMISSION_RULE_NOT_FOUND, "权限规则不存在");
        }
        log.info("Permission rule deleted, tenantId={}, ruleId={}", tenantId, ruleId);
    }

    // ==================== 矩阵 ====================

    @Transactional(readOnly = true)
    public PermissionMatrixResponse matrix(String subjectId, String resourceType) {
        String tenantId = TenantContext.getOrDefault();
        List<McpPermissionRuleEntity> rules = repository.findAllForMatrix(tenantId, subjectId, resourceType);

        // 去重提取 subjects / resources，保持插入顺序
        List<PermissionMatrixResponse.SubjectKey> subjects = new ArrayList<>();
        List<PermissionMatrixResponse.ResourceKey> resources = new ArrayList<>();
        Map<String, Integer> subjectIndex = new HashMap<>();
        Map<String, Integer> resourceIndex = new HashMap<>();
        for (McpPermissionRuleEntity r : rules) {
            String sk = r.getSubjectType() + ":" + r.getSubjectId();
            if (!subjectIndex.containsKey(sk)) {
                subjectIndex.put(sk, subjects.size());
                subjects.add(PermissionMatrixResponse.SubjectKey.builder()
                        .subjectType(r.getSubjectType())
                        .subjectId(r.getSubjectId())
                        .build());
            }
            String rk = r.getResourceType() + ":" + (r.getResourceId() == null ? "*" : r.getResourceId());
            if (!resourceIndex.containsKey(rk)) {
                resourceIndex.put(rk, resources.size());
                resources.add(PermissionMatrixResponse.ResourceKey.builder()
                        .resourceType(r.getResourceType())
                        .resourceId(r.getResourceId())
                        .build());
            }
        }

        // 按(subject, resource)分组规则
        Map<String, List<McpPermissionRuleEntity>> grouped = rules.stream()
                .collect(Collectors.groupingBy(r -> subjectIndex.get(r.getSubjectType() + ":" + r.getSubjectId())
                        + ":" + resourceIndex.get(r.getResourceType() + ":" + (r.getResourceId() == null ? "*" : r.getResourceId()))));

        // 评估每个单元格（基于 action=execute）
        List<List<PermissionMatrixResponse.MatrixCell>> matrix = new ArrayList<>(subjects.size());
        for (int i = 0; i < subjects.size(); i++) {
            List<PermissionMatrixResponse.MatrixCell> row = new ArrayList<>(resources.size());
            for (int j = 0; j < resources.size(); j++) {
                List<McpPermissionRuleEntity> cellRules = grouped.getOrDefault(i + ":" + j, List.of());
                EvaluationResult eval = evaluate(cellRules, DEFAULT_ACTION_FOR_MATRIX);
                row.add(PermissionMatrixResponse.MatrixCell.builder()
                        .allowed(eval.allowed)
                        .ruleIds(eval.matchedRules.stream().map(McpPermissionRuleEntity::getRuleId).toList())
                        .build());
            }
            matrix.add(row);
        }
        return PermissionMatrixResponse.builder()
                .subjects(subjects)
                .resources(resources)
                .permissions(matrix)
                .build();
    }

    // ==================== 权限检查 ====================

    @Transactional(readOnly = true)
    public PermissionCheckResponse check(PermissionCheckRequest request) {
        String tenantId = TenantContext.getOrDefault();
        String resourceId = request.resourceId();
        List<McpPermissionRuleEntity> candidates = repository.findCandidatesForCheck(
                tenantId, request.subjectId(), request.resourceType().toUpperCase(), resourceId);
        EvaluationResult eval = evaluate(candidates, request.action());
        return PermissionCheckResponse.builder()
                .allowed(eval.allowed)
                .decision(eval.decision)
                .effect(eval.effect)
                .matchedRules(eval.matchedRules.stream().map(e -> PermissionCheckResponse.MatchedRule.builder()
                        .ruleId(e.getRuleId())
                        .name(e.getName())
                        .effect(e.getEffect())
                        .priority(e.getPriority())
                        .actions(e.getActions())
                        .build()).toList())
                .reason(eval.reason)
                .build();
    }

    // ==================== 应用工具授权（供 ExternalAppConfigService 复用） ====================

    @Transactional(readOnly = true)
    public List<McpPermissionRuleEntity> listAppToolGrants(String tenantId, String appId) {
        return repository.findByTenantIdAndSubjectTypeAndSubjectId(tenantId, SUBJECT_TYPE_EXTERNAL_APP, appId);
    }

    @Transactional
    public void replaceAppToolGrants(String tenantId, String appId, List<String> toolIds) {
        // 删除旧授权
        List<McpPermissionRuleEntity> existing = repository
                .findByTenantIdAndSubjectTypeAndSubjectId(tenantId, SUBJECT_TYPE_EXTERNAL_APP, appId);
        repository.deleteAll(existing);
        // 写入新授权（每条 TOOL + execute + ALLOW）
        for (String toolId : toolIds) {
            McpPermissionRuleEntity rule = McpPermissionRuleEntity.builder()
                    .tenantId(tenantId)
                    .ruleId(UUID.randomUUID().toString())
                    .name("app-" + appId + "-tool-" + toolId)
                    .subjectType(SUBJECT_TYPE_EXTERNAL_APP)
                    .subjectId(appId)
                    .resourceType("TOOL")
                    .resourceId(toolId)
                    .actions("execute")
                    .effect(EFFECT_ALLOW)
                    .priority(0)
                    .enabled(Boolean.TRUE)
                    .build();
            repository.save(rule);
        }
    }

    // ==================== 内部工具 ====================

    private McpPermissionRuleEntity findById(String ruleId) {
        String tenantId = TenantContext.getOrDefault();
        return repository.findByTenantIdAndRuleId(tenantId, ruleId)
                .orElseThrow(() -> new McpException(ErrorCode.PERMISSION_RULE_NOT_FOUND, "权限规则不存在"));
    }

    private PermissionRuleResponse toResponse(McpPermissionRuleEntity e) {
        return PermissionRuleResponse.builder()
                .id(e.getId())
                .ruleId(e.getRuleId())
                .name(e.getName())
                .subjectType(e.getSubjectType())
                .subjectId(e.getSubjectId())
                .resourceType(e.getResourceType())
                .resourceId(e.getResourceId())
                .actions(e.getActions())
                .effect(e.getEffect())
                .priority(e.getPriority())
                .enabled(e.getEnabled())
                .createdAt(e.getCreatedAt())
                .updatedAt(e.getUpdatedAt())
                .build();
    }

    private String normalizeActions(String actions) {
        if (actions == null || actions.isBlank()) {
            return "execute";
        }
        return Arrays.stream(actions.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .map(String::toLowerCase)
                .collect(Collectors.joining(","));
    }

    /**
     * 核心评估逻辑：按 priority 降序取最高优先级组，同组 DENY 优先。
     */
    private EvaluationResult evaluate(List<McpPermissionRuleEntity> candidates, String action) {
        String normalizedAction = action == null ? "" : action.trim().toLowerCase();
        // 1. 动作匹配
        List<McpPermissionRuleEntity> matched = candidates.stream()
                .filter(r -> actionMatches(r.getActions(), normalizedAction))
                .toList();
        if (matched.isEmpty()) {
            return new EvaluationResult(false, "DENY", null, List.of(),
                    "无匹配规则，默认拒绝");
        }
        // 2. 找最高优先级
        int maxPriority = matched.stream().mapToInt(McpPermissionRuleEntity::getPriority).max().orElse(0);
        List<McpPermissionRuleEntity> topGroup = matched.stream()
                .filter(r -> r.getPriority() == maxPriority)
                .toList();
        // 3. DENY 优先
        boolean hasDeny = topGroup.stream().anyMatch(r -> EFFECT_DENY.equalsIgnoreCase(r.getEffect()));
        if (hasDeny) {
            return new EvaluationResult(false, "DENY", EFFECT_DENY, topGroup,
                    "命中优先级 " + maxPriority + " 的 DENY 规则，拒绝");
        }
        // 4. ALLOW
        return new EvaluationResult(true, "ALLOW", EFFECT_ALLOW, topGroup,
                "命中优先级 " + maxPriority + " 的 ALLOW 规则，允许");
    }

    private boolean actionMatches(String actionsCsv, String action) {
        if (actionsCsv == null || actionsCsv.isBlank()) {
            return false;
        }
        return Arrays.stream(actionsCsv.split(","))
                .map(String::trim)
                .map(String::toLowerCase)
                .anyMatch(a -> a.equals(action));
    }

    private record EvaluationResult(boolean allowed, String decision, String effect,
                                    List<McpPermissionRuleEntity> matchedRules, String reason) {
    }
}
