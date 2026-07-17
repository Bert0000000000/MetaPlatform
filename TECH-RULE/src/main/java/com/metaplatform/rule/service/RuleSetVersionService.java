package com.metaplatform.rule.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.metaplatform.rule.common.ErrorCode;
import com.metaplatform.rule.common.PageResponse;
import com.metaplatform.rule.common.TenantContext;
import com.metaplatform.rule.dto.RuleSetVersionCreateRequest;
import com.metaplatform.rule.dto.RuleSetVersionResponse;
import com.metaplatform.rule.entity.RuleDefinitionEntity;
import com.metaplatform.rule.entity.RuleSetEntity;
import com.metaplatform.rule.entity.RuleSetVersionEntity;
import com.metaplatform.rule.exception.RuleException;
import com.metaplatform.rule.repository.RuleDefinitionRepository;
import com.metaplatform.rule.repository.RuleSetRepository;
import com.metaplatform.rule.repository.RuleSetVersionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class RuleSetVersionService {

    private final RuleSetVersionRepository versionRepository;
    private final RuleSetRepository ruleSetRepository;
    private final RuleDefinitionRepository ruleDefinitionRepository;
    private final ObjectMapper objectMapper;

    @Transactional
    public RuleSetVersionResponse createVersion(String rulesetId, RuleSetVersionCreateRequest request) {
        String tenantId = TenantContext.get();
        RuleSetEntity ruleset = ruleSetRepository.findByIdAndDeletedFalse(rulesetId)
                .orElseThrow(() -> new RuleException(ErrorCode.RULESET_NOT_FOUND));
        if (!tenantId.equals(ruleset.getTenantId())) {
            throw new RuleException(ErrorCode.TENANT_MISMATCH);
        }

        int nextVersion = versionRepository.findTopByTenantIdAndRulesetIdOrderByVersionNumberDesc(tenantId, rulesetId)
                .map(v -> v.getVersionNumber() + 1)
                .orElse(ruleset.getVersion() != null ? ruleset.getVersion() + 1 : 2);

        List<RuleDefinitionEntity> rules = ruleDefinitionRepository
                .findByTenantIdAndRulesetIdAndDeletedFalseAndEnabledTrueOrderByPriorityAscCreatedAtAsc(tenantId, rulesetId);

        JsonNode snapshot = buildSnapshot(ruleset, rules);

        RuleSetVersionEntity version = RuleSetVersionEntity.builder()
                .id(UUID.randomUUID().toString())
                .tenantId(tenantId)
                .rulesetId(rulesetId)
                .versionNumber(nextVersion)
                .description(request != null ? request.getDescription() : null)
                .status("DRAFT")
                .snapshot(snapshot)
                .createdBy(TenantContext.getUserId())
                .build();

        RuleSetVersionEntity saved = versionRepository.save(version);

        ruleset.setVersion(nextVersion);
        ruleset.setUpdatedBy(TenantContext.getUserId());
        ruleSetRepository.save(ruleset);

        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public PageResponse<RuleSetVersionResponse> listVersions(String rulesetId, int page, int pageSize) {
        String tenantId = TenantContext.get();
        RuleSetEntity ruleset = ruleSetRepository.findByIdAndDeletedFalse(rulesetId)
                .orElseThrow(() -> new RuleException(ErrorCode.RULESET_NOT_FOUND));
        if (!tenantId.equals(ruleset.getTenantId())) {
            throw new RuleException(ErrorCode.TENANT_MISMATCH);
        }
        List<RuleSetVersionEntity> all = versionRepository.findByTenantIdAndRulesetIdOrderByVersionNumberDesc(tenantId, rulesetId);
        int from = Math.max(0, (page - 1) * pageSize);
        int to = Math.min(all.size(), from + pageSize);
        List<RuleSetVersionResponse> items = all.subList(from, to).stream().map(this::toResponse).toList();
        int totalPages = all.isEmpty() ? 0 : (int) Math.ceil((double) all.size() / pageSize);
        return PageResponse.<RuleSetVersionResponse>builder()
                .items(items)
                .total(all.size())
                .page(page)
                .pageSize(pageSize)
                .totalPages(totalPages)
                .build();
    }

    @Transactional(readOnly = true)
    public RuleSetVersionResponse getVersion(String versionId) {
        String tenantId = TenantContext.get();
        RuleSetVersionEntity version = versionRepository.findByIdAndTenantId(versionId, tenantId)
                .orElseThrow(() -> new RuleException(ErrorCode.RULESET_VERSION_NOT_FOUND));
        return toResponse(version);
    }

    private JsonNode buildSnapshot(RuleSetEntity ruleset, List<RuleDefinitionEntity> rules) {
        ObjectNode root = objectMapper.createObjectNode();
        ObjectNode rsNode = objectMapper.createObjectNode();
        rsNode.put("id", ruleset.getId());
        rsNode.put("code", ruleset.getCode());
        rsNode.put("name", ruleset.getName());
        rsNode.put("description", ruleset.getDescription());
        rsNode.put("status", ruleset.getStatus() != null ? ruleset.getStatus().name() : null);
        rsNode.put("priority", ruleset.getPriority());
        rsNode.put("enabled", ruleset.getEnabled());
        root.set("ruleset", rsNode);

        ArrayNode rulesNode = objectMapper.createArrayNode();
        for (RuleDefinitionEntity rule : rules) {
            ObjectNode r = objectMapper.createObjectNode();
            r.put("id", rule.getId());
            r.put("code", rule.getCode());
            r.put("name", rule.getName());
            r.put("description", rule.getDescription());
            r.put("conditionExpr", rule.getConditionExpr());
            r.put("actionType", rule.getActionType() != null ? rule.getActionType().name() : null);
            r.set("actionConfig", rule.getActionConfig());
            r.put("priority", rule.getPriority());
            r.put("enabled", rule.getEnabled());
            rulesNode.add(r);
        }
        root.set("rules", rulesNode);
        return root;
    }

    private RuleSetVersionResponse toResponse(RuleSetVersionEntity entity) {
        return RuleSetVersionResponse.builder()
                .id(entity.getId())
                .rulesetId(entity.getRulesetId())
                .versionNumber(entity.getVersionNumber())
                .description(entity.getDescription())
                .status(entity.getStatus())
                .snapshot(entity.getSnapshot())
                .createdAt(entity.getCreatedAt())
                .createdBy(entity.getCreatedBy())
                .build();
    }
}
