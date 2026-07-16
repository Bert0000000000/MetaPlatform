package com.metaplatform.rule.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.rule.common.ErrorCode;
import com.metaplatform.rule.common.PageResponse;
import com.metaplatform.rule.common.TenantContext;
import com.metaplatform.rule.dto.RuleDefinitionCreateRequest;
import com.metaplatform.rule.dto.RuleDefinitionResponse;
import com.metaplatform.rule.dto.RuleDefinitionUpdateRequest;
import com.metaplatform.rule.entity.ActionType;
import com.metaplatform.rule.entity.RuleDefinitionEntity;
import com.metaplatform.rule.entity.RuleSetEntity;
import com.metaplatform.rule.exception.RuleException;
import com.metaplatform.rule.repository.RuleDefinitionRepository;
import com.metaplatform.rule.repository.RuleSetRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class RuleDefinitionService {

    private final RuleDefinitionRepository ruleDefinitionRepository;
    private final RuleSetRepository ruleSetRepository;
    private final OntologyReferenceValidator ontologyReferenceValidator;
    private final ObjectMapper objectMapper;

    @Transactional
    public RuleDefinitionResponse create(RuleDefinitionCreateRequest request) {
        String tenantId = TenantContext.get();

        // 验证规则集存在且属于当前租户
        RuleSetEntity ruleSet = ruleSetRepository.findByIdAndDeletedFalse(request.getRulesetId())
                .orElseThrow(() -> new RuleException(ErrorCode.RULESET_NOT_FOUND));
        if (!tenantId.equals(ruleSet.getTenantId())) {
            throw new RuleException(ErrorCode.TENANT_MISMATCH);
        }

        // 检查规则编码唯一性
        if (ruleDefinitionRepository.existsByTenantIdAndRulesetIdAndCodeAndDeletedFalse(
                tenantId, request.getRulesetId(), request.getCode())) {
            throw new RuleException(ErrorCode.RULE_ALREADY_EXISTS);
        }

        // 校验本体引用
        ontologyReferenceValidator.validate(request.getConditionExpr());

        RuleDefinitionEntity entity = RuleDefinitionEntity.builder()
                .id(UUID.randomUUID().toString())
                .tenantId(tenantId)
                .rulesetId(request.getRulesetId())
                .code(request.getCode())
                .name(request.getName())
                .description(request.getDescription())
                .conditionExpr(request.getConditionExpr())
                .actionType(request.getActionType())
                .actionConfig(toJsonNode(request.getActionConfig()))
                .priority(request.getPriority() != null ? request.getPriority() : 0)
                .enabled(request.getEnabled() != null ? request.getEnabled() : true)
                .createdBy(TenantContext.getUserId())
                .updatedBy(TenantContext.getUserId())
                .build();

        RuleDefinitionEntity saved = ruleDefinitionRepository.save(entity);
        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public PageResponse<RuleDefinitionResponse> list(String rulesetId, int page, int pageSize) {
        String tenantId = TenantContext.get();
        PageRequest pageRequest = PageRequest.of(Math.max(0, page - 1), Math.max(1, pageSize),
                Sort.by(Sort.Direction.ASC, "priority").and(Sort.by(Sort.Direction.DESC, "createdAt")));

        Page<RuleDefinitionEntity> result =
                ruleDefinitionRepository.findByTenantIdAndRulesetIdAndDeletedFalse(tenantId, rulesetId, pageRequest);

        return PageResponse.<RuleDefinitionResponse>builder()
                .items(result.getContent().stream().map(this::toResponse).toList())
                .total(result.getTotalElements())
                .page(page)
                .pageSize(pageSize)
                .totalPages(result.getTotalPages())
                .build();
    }

    @Transactional(readOnly = true)
    public RuleDefinitionResponse getById(String id) {
        return toResponse(findRuleDefinition(id));
    }

    @Transactional
    public RuleDefinitionResponse update(String id, RuleDefinitionUpdateRequest request) {
        RuleDefinitionEntity entity = findRuleDefinition(id);

        if (StringUtils.hasText(request.getName())) {
            entity.setName(request.getName());
        }
        if (request.getDescription() != null) {
            entity.setDescription(request.getDescription());
        }
        if (StringUtils.hasText(request.getConditionExpr())) {
            ontologyReferenceValidator.validate(request.getConditionExpr());
            entity.setConditionExpr(request.getConditionExpr());
        }
        if (request.getActionType() != null) {
            entity.setActionType(request.getActionType());
        }
        if (request.getActionConfig() != null) {
            entity.setActionConfig(toJsonNode(request.getActionConfig()));
        }
        if (request.getPriority() != null) {
            entity.setPriority(request.getPriority());
        }
        if (request.getEnabled() != null) {
            entity.setEnabled(request.getEnabled());
        }
        entity.setUpdatedBy(TenantContext.getUserId());

        RuleDefinitionEntity saved = ruleDefinitionRepository.save(entity);
        return toResponse(saved);
    }

    @Transactional
    public void delete(String id) {
        RuleDefinitionEntity entity = findRuleDefinition(id);
        entity.setDeleted(true);
        entity.setUpdatedBy(TenantContext.getUserId());
        ruleDefinitionRepository.save(entity);
    }

    private RuleDefinitionEntity findRuleDefinition(String id) {
        String tenantId = TenantContext.get();
        RuleDefinitionEntity entity = ruleDefinitionRepository.findByIdAndDeletedFalse(id)
                .orElseThrow(() -> new RuleException(ErrorCode.RULE_NOT_FOUND));
        if (!tenantId.equals(entity.getTenantId())) {
            throw new RuleException(ErrorCode.TENANT_MISMATCH);
        }
        return entity;
    }

    private RuleDefinitionResponse toResponse(RuleDefinitionEntity entity) {
        return RuleDefinitionResponse.builder()
                .id(entity.getId())
                .tenantId(entity.getTenantId())
                .rulesetId(entity.getRulesetId())
                .code(entity.getCode())
                .name(entity.getName())
                .description(entity.getDescription())
                .conditionExpr(entity.getConditionExpr())
                .actionType(entity.getActionType().name())
                .actionConfig(toMap(entity.getActionConfig()))
                .priority(entity.getPriority())
                .enabled(entity.getEnabled())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .createdBy(entity.getCreatedBy())
                .updatedBy(entity.getUpdatedBy())
                .build();
    }

    private JsonNode toJsonNode(Object value) {
        if (value == null) {
            return null;
        }
        return objectMapper.valueToTree(value);
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> toMap(JsonNode jsonNode) {
        if (jsonNode == null) {
            return null;
        }
        return objectMapper.convertValue(jsonNode, Map.class);
    }
}
