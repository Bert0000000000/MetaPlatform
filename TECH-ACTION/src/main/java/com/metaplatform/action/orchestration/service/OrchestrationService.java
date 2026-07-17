package com.metaplatform.action.orchestration.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.action.common.ErrorCode;
import com.metaplatform.action.common.PageResponse;
import com.metaplatform.action.common.TenantContext;
import com.metaplatform.action.exception.ActionException;
import com.metaplatform.action.orchestration.dto.CreateOrchestrationRequest;
import com.metaplatform.action.orchestration.dto.OrchestrationListItem;
import com.metaplatform.action.orchestration.dto.OrchestrationResponse;
import com.metaplatform.action.orchestration.dto.UpdateOrchestrationRequest;
import com.metaplatform.action.orchestration.entity.OrchestrationEntity;
import com.metaplatform.action.orchestration.repository.OrchestrationRepository;
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
public class OrchestrationService {

    public static final String STATUS_DRAFT = "DRAFT";
    public static final String STATUS_PUBLISHED = "PUBLISHED";
    public static final String STATUS_DISABLED = "DISABLED";

    private final OrchestrationRepository orchestrationRepository;
    private final ObjectMapper objectMapper;
    private final GraphValidator graphValidator;

    @Transactional
    public OrchestrationResponse create(CreateOrchestrationRequest request) {
        String tenantId = TenantContext.getOrDefault();
        if (orchestrationRepository.existsByTenantIdAndCodeAndDeletedAtIsNull(tenantId, request.getCode())) {
            throw new ActionException(ErrorCode.ALREADY_EXISTS, "编排 code 在该租户下已存在");
        }
        String nodes = normalizeJson(request.getNodes(), "[]");
        String edges = normalizeJson(request.getEdges(), "[]");
        graphValidator.validate(nodes, edges);

        String orchestrationId = "orch-" + UUID.randomUUID();
        Instant now = Instant.now();
        String operator = currentOperator();
        OrchestrationEntity entity = OrchestrationEntity.builder()
                .tenantId(tenantId)
                .orchestrationId(orchestrationId)
                .code(request.getCode())
                .name(request.getName())
                .description(request.getDescription())
                .nodes(nodes)
                .edges(edges)
                .ruleIntegration("{}")
                .status(STATUS_DRAFT)
                .version(1)
                .createdBy(operator)
                .updatedBy(operator)
                .createdAt(now)
                .updatedAt(now)
                .build();
        return toResponse(orchestrationRepository.save(entity));
    }

    @Transactional(readOnly = true)
    public PageResponse<OrchestrationListItem> list(String status, String keyword, Integer page, Integer size) {
        String tenantId = TenantContext.getOrDefault();
        int p = page == null || page < 1 ? 1 : page;
        int s = size == null || size < 1 ? 20 : Math.min(size, 100);
        Pageable pageable = PageRequest.of(p - 1, s, Sort.by(Sort.Direction.DESC, "updatedAt"));
        Page<OrchestrationEntity> result = orchestrationRepository.search(tenantId, status, keyword, pageable);
        return PageResponse.<OrchestrationListItem>builder()
                .items(result.getContent().stream().map(this::toListItem).toList())
                .total(result.getTotalElements())
                .page(p)
                .size(s)
                .totalPages(result.getTotalPages())
                .build();
    }

    @Transactional(readOnly = true)
    public OrchestrationResponse get(String id) {
        return toResponse(findByOrchestrationId(id));
    }

    @Transactional
    public OrchestrationResponse update(String id, UpdateOrchestrationRequest request) {
        OrchestrationEntity entity = findByOrchestrationId(id);
        if (STATUS_DISABLED.equals(entity.getStatus())) {
            throw new ActionException(ErrorCode.STATE_CONFLICT, "已禁用的编排不可更新");
        }
        if (request.getName() != null) {
            entity.setName(request.getName());
        }
        if (request.getDescription() != null) {
            entity.setDescription(request.getDescription());
        }
        if (request.getNodes() != null || request.getEdges() != null) {
            String nodes = normalizeJson(request.getNodes(), entity.getNodes());
            String edges = normalizeJson(request.getEdges(), entity.getEdges());
            graphValidator.validate(nodes, edges);
            entity.setNodes(nodes);
            entity.setEdges(edges);
        }
        entity.setVersion(entity.getVersion() + 1);
        entity.setUpdatedBy(currentOperator());
        entity.setUpdatedAt(Instant.now());
        if (STATUS_PUBLISHED.equals(entity.getStatus())) {
            entity.setStatus(STATUS_DRAFT);
        }
        return toResponse(orchestrationRepository.save(entity));
    }

    @Transactional
    public void delete(String id) {
        OrchestrationEntity entity = findByOrchestrationId(id);
        entity.setDeletedAt(Instant.now());
        entity.setUpdatedBy(currentOperator());
        entity.setUpdatedAt(Instant.now());
        orchestrationRepository.save(entity);
    }

    @Transactional
    public OrchestrationResponse publish(String id) {
        OrchestrationEntity entity = findByOrchestrationId(id);
        if (STATUS_PUBLISHED.equals(entity.getStatus())) {
            throw new ActionException(ErrorCode.STATE_CONFLICT, "编排已发布");
        }
        if (STATUS_DISABLED.equals(entity.getStatus())) {
            throw new ActionException(ErrorCode.STATE_CONFLICT, "已禁用的编排不可直接发布");
        }
        entity.setStatus(STATUS_PUBLISHED);
        entity.setUpdatedBy(currentOperator());
        entity.setUpdatedAt(Instant.now());
        return toResponse(orchestrationRepository.save(entity));
    }

    @Transactional
    public OrchestrationResponse disable(String id) {
        OrchestrationEntity entity = findByOrchestrationId(id);
        if (STATUS_DISABLED.equals(entity.getStatus())) {
            throw new ActionException(ErrorCode.STATE_CONFLICT, "编排已禁用");
        }
        if (STATUS_DRAFT.equals(entity.getStatus())) {
            throw new ActionException(ErrorCode.STATE_CONFLICT, "草稿状态的编排不可禁用");
        }
        entity.setStatus(STATUS_DISABLED);
        entity.setUpdatedBy(currentOperator());
        entity.setUpdatedAt(Instant.now());
        return toResponse(orchestrationRepository.save(entity));
    }

    @Transactional
    public OrchestrationResponse configureConditionRules(String id, String ruleIntegrationJson) {
        OrchestrationEntity entity = findByOrchestrationId(id);
        validateJson(ruleIntegrationJson, "ruleIntegration");
        entity.setRuleIntegration(normalizeJson(ruleIntegrationJson, "{}"));
        entity.setVersion(entity.getVersion() + 1);
        entity.setUpdatedBy(currentOperator());
        entity.setUpdatedAt(Instant.now());
        return toResponse(orchestrationRepository.save(entity));
    }

    OrchestrationEntity findByOrchestrationId(String orchestrationId) {
        String tenantId = TenantContext.getOrDefault();
        return orchestrationRepository.findByTenantIdAndOrchestrationIdAndDeletedAtIsNull(tenantId, orchestrationId)
                .orElseThrow(() -> new ActionException(ErrorCode.ORCHESTRATION_NOT_FOUND, "编排不存在"));
    }

    private OrchestrationResponse toResponse(OrchestrationEntity entity) {
        return OrchestrationResponse.builder()
                .orchestrationId(entity.getOrchestrationId())
                .code(entity.getCode())
                .name(entity.getName())
                .description(entity.getDescription())
                .nodes(entity.getNodes())
                .edges(entity.getEdges())
                .ruleIntegration(entity.getRuleIntegration())
                .status(entity.getStatus())
                .version(entity.getVersion())
                .createdBy(entity.getCreatedBy())
                .updatedBy(entity.getUpdatedBy())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }

    private OrchestrationListItem toListItem(OrchestrationEntity entity) {
        return OrchestrationListItem.builder()
                .orchestrationId(entity.getOrchestrationId())
                .code(entity.getCode())
                .name(entity.getName())
                .status(entity.getStatus())
                .version(entity.getVersion())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
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
