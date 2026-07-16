package com.metaplatform.rule.service;

import com.metaplatform.rule.common.ErrorCode;
import com.metaplatform.rule.common.PageResponse;
import com.metaplatform.rule.common.TenantContext;
import com.metaplatform.rule.dto.RuleSetCreateRequest;
import com.metaplatform.rule.dto.RuleSetResponse;
import com.metaplatform.rule.dto.RuleSetUpdateRequest;
import com.metaplatform.rule.entity.RuleSetEntity;
import com.metaplatform.rule.entity.RuleStatus;
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

import java.util.UUID;

@Service
@RequiredArgsConstructor
public class RuleSetService {

    private final RuleSetRepository ruleSetRepository;
    private final RuleDefinitionRepository ruleDefinitionRepository;

    @Transactional
    public RuleSetResponse create(RuleSetCreateRequest request) {
        String tenantId = TenantContext.get();
        if (ruleSetRepository.existsByTenantIdAndCodeAndDeletedFalse(tenantId, request.getCode())) {
            throw new RuleException(ErrorCode.RULESET_ALREADY_EXISTS);
        }

        RuleSetEntity entity = RuleSetEntity.builder()
                .id(UUID.randomUUID().toString())
                .tenantId(tenantId)
                .code(request.getCode())
                .name(request.getName())
                .description(request.getDescription())
                .status(request.getStatus() != null ? request.getStatus() : RuleStatus.ENABLED)
                .priority(request.getPriority() != null ? request.getPriority() : 0)
                .version(1)
                .createdBy(TenantContext.getUserId())
                .updatedBy(TenantContext.getUserId())
                .build();

        RuleSetEntity saved = ruleSetRepository.save(entity);
        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public PageResponse<RuleSetResponse> list(RuleStatus status, int page, int pageSize) {
        String tenantId = TenantContext.get();
        PageRequest pageRequest = PageRequest.of(Math.max(0, page - 1), Math.max(1, pageSize),
                Sort.by(Sort.Direction.ASC, "priority").and(Sort.by(Sort.Direction.DESC, "createdAt")));

        Page<RuleSetEntity> result;
        if (status != null) {
            result = ruleSetRepository.findByTenantIdAndDeletedFalseAndStatus(tenantId, status, pageRequest);
        } else {
            result = ruleSetRepository.findByTenantIdAndDeletedFalse(tenantId, pageRequest);
        }

        return PageResponse.<RuleSetResponse>builder()
                .items(result.getContent().stream().map(this::toResponse).toList())
                .total(result.getTotalElements())
                .page(page)
                .pageSize(pageSize)
                .totalPages(result.getTotalPages())
                .build();
    }

    @Transactional(readOnly = true)
    public RuleSetResponse getById(String id) {
        return toResponse(findRuleSet(id));
    }

    @Transactional
    public RuleSetResponse update(String id, RuleSetUpdateRequest request) {
        RuleSetEntity entity = findRuleSet(id);

        if (StringUtils.hasText(request.getName())) {
            entity.setName(request.getName());
        }
        if (request.getDescription() != null) {
            entity.setDescription(request.getDescription());
        }
        if (request.getStatus() != null) {
            entity.setStatus(request.getStatus());
        }
        if (request.getPriority() != null) {
            entity.setPriority(request.getPriority());
        }
        entity.setUpdatedBy(TenantContext.getUserId());

        RuleSetEntity saved = ruleSetRepository.save(entity);
        return toResponse(saved);
    }

    @Transactional
    public void delete(String id) {
        String tenantId = TenantContext.get();
        RuleSetEntity entity = findRuleSet(id);

        long ruleCount = ruleDefinitionRepository.countByTenantIdAndRulesetIdAndDeletedFalse(tenantId, id);
        if (ruleCount > 0) {
            throw new RuleException(ErrorCode.RULESET_HAS_RULES);
        }

        entity.setDeleted(true);
        entity.setUpdatedBy(TenantContext.getUserId());
        ruleSetRepository.save(entity);
    }

    private RuleSetEntity findRuleSet(String id) {
        String tenantId = TenantContext.get();
        RuleSetEntity entity = ruleSetRepository.findByIdAndDeletedFalse(id)
                .orElseThrow(() -> new RuleException(ErrorCode.RULESET_NOT_FOUND));
        if (!tenantId.equals(entity.getTenantId())) {
            throw new RuleException(ErrorCode.TENANT_MISMATCH);
        }
        return entity;
    }

    private RuleSetResponse toResponse(RuleSetEntity entity) {
        return RuleSetResponse.builder()
                .id(entity.getId())
                .tenantId(entity.getTenantId())
                .code(entity.getCode())
                .name(entity.getName())
                .description(entity.getDescription())
                .status(entity.getStatus().name())
                .priority(entity.getPriority())
                .version(entity.getVersion())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .createdBy(entity.getCreatedBy())
                .updatedBy(entity.getUpdatedBy())
                .build();
    }
}
