package com.metaplatform.action.definition.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.action.common.ErrorCode;
import com.metaplatform.action.common.PageResponse;
import com.metaplatform.action.common.TenantContext;
import com.metaplatform.action.definition.dto.ActionDefinitionListItem;
import com.metaplatform.action.definition.dto.ActionDefinitionResponse;
import com.metaplatform.action.definition.dto.CreateActionDefinitionRequest;
import com.metaplatform.action.definition.dto.UpdateActionDefinitionRequest;
import com.metaplatform.action.definition.entity.ActionDefinitionEntity;
import com.metaplatform.action.definition.repository.ActionDefinitionRepository;
import com.metaplatform.action.exception.ActionException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ActionDefinitionService {

    private static final String STATUS_DRAFT = "DRAFT";
    private static final String STATUS_PUBLISHED = "PUBLISHED";
    private static final String STATUS_DISABLED = "DISABLED";

    private final ActionDefinitionRepository actionDefinitionRepository;
    private final ObjectMapper objectMapper;

    @Transactional
    public ActionDefinitionResponse create(CreateActionDefinitionRequest request) {
        String tenantId = TenantContext.getOrDefault();
        if (actionDefinitionRepository.existsByTenantIdAndCodeAndDeletedAtIsNull(tenantId, request.getCode())) {
            throw new ActionException(ErrorCode.ALREADY_EXISTS, "Action code 在该租户下已存在");
        }
        validateJson(request.getHeaders(), "headers");
        validateJson(request.getInputSchema(), "inputSchema");
        validateJson(request.getOutputSchema(), "outputSchema");

        String actionId = generateActionId();
        String operator = currentOperator();
        Instant now = Instant.now();
        ActionDefinitionEntity entity = ActionDefinitionEntity.builder()
                .tenantId(tenantId)
                .actionId(actionId)
                .code(request.getCode())
                .name(request.getName())
                .description(request.getDescription())
                .method(request.getMethod().toUpperCase())
                .url(request.getUrl())
                .headers(normalizeJson(request.getHeaders(), "{}"))
                .inputSchema(request.getInputSchema())
                .outputSchema(request.getOutputSchema())
                .status(STATUS_DRAFT)
                .version(1)
                .createdBy(operator)
                .updatedBy(operator)
                .createdAt(now)
                .updatedAt(now)
                .build();
        ActionDefinitionEntity saved = actionDefinitionRepository.save(entity);
        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public PageResponse<ActionDefinitionListItem> list(String status, String keyword, Integer page, Integer size) {
        String tenantId = TenantContext.getOrDefault();
        int p = page == null || page < 1 ? 1 : page;
        int s = size == null || size < 1 ? 20 : Math.min(size, 100);
        Pageable pageable = PageRequest.of(p - 1, s, Sort.by(Sort.Direction.DESC, "updatedAt"));

        String keywordPattern = (keyword == null || keyword.isBlank())
                ? null
                : "%" + keyword.toLowerCase() + "%";
        Page<ActionDefinitionEntity> result = actionDefinitionRepository.search(tenantId, status, keywordPattern, pageable);
        return PageResponse.<ActionDefinitionListItem>builder()
                .items(result.getContent().stream().map(this::toListItem).toList())
                .total(result.getTotalElements())
                .page(p)
                .size(s)
                .totalPages(result.getTotalPages())
                .build();
    }

    @Transactional(readOnly = true)
    public ActionDefinitionResponse get(String id) {
        ActionDefinitionEntity entity = findByActionId(id);
        return toResponse(entity);
    }

    @Transactional
    public ActionDefinitionResponse update(String id, UpdateActionDefinitionRequest request) {
        ActionDefinitionEntity entity = findByActionId(id);
        if (STATUS_DISABLED.equals(entity.getStatus())) {
            throw new ActionException(ErrorCode.STATE_CONFLICT, "已禁用的 Action 不可更新");
        }
        if (request.getName() != null) {
            entity.setName(request.getName());
        }
        if (request.getDescription() != null) {
            entity.setDescription(request.getDescription());
        }
        if (request.getMethod() != null) {
            entity.setMethod(request.getMethod().toUpperCase());
        }
        if (request.getUrl() != null) {
            entity.setUrl(request.getUrl());
        }
        if (request.getHeaders() != null) {
            validateJson(request.getHeaders(), "headers");
            entity.setHeaders(normalizeJson(request.getHeaders(), "{}"));
        }
        if (request.getInputSchema() != null) {
            validateJson(request.getInputSchema(), "inputSchema");
            entity.setInputSchema(request.getInputSchema());
        }
        if (request.getOutputSchema() != null) {
            validateJson(request.getOutputSchema(), "outputSchema");
            entity.setOutputSchema(request.getOutputSchema());
        }
        entity.setVersion(entity.getVersion() + 1);
        entity.setUpdatedBy(currentOperator());
        entity.setUpdatedAt(Instant.now());
        if (STATUS_PUBLISHED.equals(entity.getStatus())) {
            entity.setStatus(STATUS_DRAFT);
        }
        ActionDefinitionEntity saved = actionDefinitionRepository.save(entity);
        return toResponse(saved);
    }

    @Transactional
    public void delete(String id) {
        ActionDefinitionEntity entity = findByActionId(id);
        if (entity.getDeletedAt() != null) {
            throw new ActionException(ErrorCode.NOT_FOUND, "Action 不存在");
        }
        entity.setDeletedAt(Instant.now());
        entity.setUpdatedBy(currentOperator());
        entity.setUpdatedAt(Instant.now());
        actionDefinitionRepository.save(entity);
    }

    @Transactional
    public ActionDefinitionResponse publish(String id) {
        ActionDefinitionEntity entity = findByActionId(id);
        if (STATUS_PUBLISHED.equals(entity.getStatus())) {
            throw new ActionException(ErrorCode.STATE_CONFLICT, "Action 已发布");
        }
        if (STATUS_DISABLED.equals(entity.getStatus())) {
            throw new ActionException(ErrorCode.STATE_CONFLICT, "已禁用的 Action 不可直接发布，请先编辑更新");
        }
        entity.setStatus(STATUS_PUBLISHED);
        entity.setUpdatedBy(currentOperator());
        entity.setUpdatedAt(Instant.now());
        return toResponse(actionDefinitionRepository.save(entity));
    }

    @Transactional
    public ActionDefinitionResponse disable(String id) {
        ActionDefinitionEntity entity = findByActionId(id);
        if (STATUS_DISABLED.equals(entity.getStatus())) {
            throw new ActionException(ErrorCode.STATE_CONFLICT, "Action 已禁用");
        }
        if (STATUS_DRAFT.equals(entity.getStatus())) {
            throw new ActionException(ErrorCode.STATE_CONFLICT, "草稿状态的 Action 不可禁用");
        }
        entity.setStatus(STATUS_DISABLED);
        entity.setUpdatedBy(currentOperator());
        entity.setUpdatedAt(Instant.now());
        return toResponse(actionDefinitionRepository.save(entity));
    }

    ActionDefinitionEntity findByActionId(String actionId) {
        String tenantId = TenantContext.getOrDefault();
        return actionDefinitionRepository.findByTenantIdAndActionIdAndDeletedAtIsNull(tenantId, actionId)
                .orElseThrow(() -> new ActionException(ErrorCode.ACTION_NOT_FOUND, "Action 不存在"));
    }

    private ActionDefinitionResponse toResponse(ActionDefinitionEntity entity) {
        return ActionDefinitionResponse.builder()
                .actionId(entity.getActionId())
                .code(entity.getCode())
                .name(entity.getName())
                .description(entity.getDescription())
                .method(entity.getMethod())
                .url(entity.getUrl())
                .headers(entity.getHeaders())
                .inputSchema(entity.getInputSchema())
                .outputSchema(entity.getOutputSchema())
                .status(entity.getStatus())
                .version(entity.getVersion())
                .createdBy(entity.getCreatedBy())
                .updatedBy(entity.getUpdatedBy())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }

    private ActionDefinitionListItem toListItem(ActionDefinitionEntity entity) {
        return ActionDefinitionListItem.builder()
                .actionId(entity.getActionId())
                .code(entity.getCode())
                .name(entity.getName())
                .status(entity.getStatus())
                .version(entity.getVersion())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }

    private String generateActionId() {
        return "act-" + UUID.randomUUID();
    }

    private String currentOperator() {
        return "system";
    }

    private void validateJson(String value, String field) {
        if (value == null || value.isBlank()) {
            return;
        }
        try {
            objectMapper.readTree(value);
        } catch (Exception e) {
            throw new ActionException(ErrorCode.INVALID_PARAM, field + " 不是合法的 JSON");
        }
    }

    private String normalizeJson(String value, String defaultValue) {
        if (value == null || value.isBlank()) {
            return defaultValue;
        }
        return value;
    }
}
