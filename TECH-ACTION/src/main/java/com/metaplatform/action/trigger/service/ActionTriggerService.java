package com.metaplatform.action.trigger.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.action.common.ErrorCode;
import com.metaplatform.action.common.PageResponse;
import com.metaplatform.action.common.TenantContext;
import com.metaplatform.action.common.TraceContext;
import com.metaplatform.action.definition.entity.ActionDefinitionEntity;
import com.metaplatform.action.definition.repository.ActionDefinitionRepository;
import com.metaplatform.action.exception.ActionException;
import com.metaplatform.action.execution.dto.SyncExecutionRequest;
import com.metaplatform.action.execution.dto.SyncExecutionResponse;
import com.metaplatform.action.execution.service.HttpExecutionService;
import com.metaplatform.action.trigger.dto.CreateTriggerRequest;
import com.metaplatform.action.trigger.dto.TriggerListItem;
import com.metaplatform.action.trigger.dto.TriggerResponse;
import com.metaplatform.action.trigger.dto.UpdateTriggerRequest;
import com.metaplatform.action.trigger.entity.ActionTriggerEntity;
import com.metaplatform.action.trigger.repository.ActionTriggerRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class ActionTriggerService {

    private final ActionTriggerRepository actionTriggerRepository;
    private final ActionDefinitionRepository actionDefinitionRepository;
    private final HttpExecutionService httpExecutionService;
    private final ObjectMapper objectMapper;

    @Transactional
    public TriggerResponse create(CreateTriggerRequest request) {
        String tenantId = TenantContext.getOrDefault();
        validateTriggerType(request.getTriggerType(), request.getEventTopic(), request.getCronExpression());
        validateActionExists(tenantId, request.getActionId());
        if (actionTriggerRepository.existsByTenantIdAndNameAndDeletedAtIsNull(tenantId, request.getName())) {
            throw new ActionException(ErrorCode.ALREADY_EXISTS, "触发器 name 在该租户下已存在");
        }
        validateJson(request.getConfig(), "config");

        String triggerId = "trg-" + UUID.randomUUID();
        Instant now = Instant.now();
        String operator = currentOperator();
        ActionTriggerEntity entity = ActionTriggerEntity.builder()
                .tenantId(tenantId)
                .triggerId(triggerId)
                .actionId(request.getActionId())
                .name(request.getName())
                .triggerType(request.getTriggerType())
                .eventTopic(request.getEventTopic())
                .cronExpression(request.getCronExpression())
                .config(normalizeJson(request.getConfig(), "{}"))
                .enabled(Boolean.TRUE)
                .createdBy(operator)
                .updatedBy(operator)
                .createdAt(now)
                .updatedAt(now)
                .build();
        return toResponse(actionTriggerRepository.save(entity));
    }

    @Transactional(readOnly = true)
    public PageResponse<TriggerListItem> list(String actionId, String triggerType, Boolean enabled,
                                              Integer page, Integer size) {
        String tenantId = TenantContext.getOrDefault();
        int p = page == null || page < 1 ? 1 : page;
        int s = size == null || size < 1 ? 20 : Math.min(size, 100);
        Pageable pageable = PageRequest.of(p - 1, s, Sort.by(Sort.Direction.DESC, "updatedAt"));
        Page<ActionTriggerEntity> result = actionTriggerRepository.search(tenantId, actionId, triggerType, enabled, pageable);
        return PageResponse.<TriggerListItem>builder()
                .items(result.getContent().stream().map(this::toListItem).toList())
                .total(result.getTotalElements())
                .page(p)
                .size(s)
                .totalPages(result.getTotalPages())
                .build();
    }

    @Transactional(readOnly = true)
    public TriggerResponse get(String triggerId) {
        return toResponse(findByTriggerId(triggerId));
    }

    @Transactional
    public TriggerResponse update(String triggerId, UpdateTriggerRequest request) {
        ActionTriggerEntity entity = findByTriggerId(triggerId);
        if (request.getTriggerType() != null) {
            validateTriggerType(request.getTriggerType(), request.getEventTopic(), request.getCronExpression());
            entity.setTriggerType(request.getTriggerType());
        }
        if (request.getName() != null) {
            entity.setName(request.getName());
        }
        if (request.getEventTopic() != null) {
            entity.setEventTopic(request.getEventTopic());
        }
        if (request.getCronExpression() != null) {
            entity.setCronExpression(request.getCronExpression());
        }
        if (request.getConfig() != null) {
            validateJson(request.getConfig(), "config");
            entity.setConfig(normalizeJson(request.getConfig(), "{}"));
        }
        entity.setUpdatedBy(currentOperator());
        entity.setUpdatedAt(Instant.now());
        return toResponse(actionTriggerRepository.save(entity));
    }

    @Transactional
    public void delete(String triggerId) {
        ActionTriggerEntity entity = findByTriggerId(triggerId);
        entity.setDeletedAt(Instant.now());
        entity.setUpdatedBy(currentOperator());
        entity.setUpdatedAt(Instant.now());
        actionTriggerRepository.save(entity);
    }

    @Transactional
    public TriggerResponse enable(String triggerId) {
        ActionTriggerEntity entity = findByTriggerId(triggerId);
        if (Boolean.TRUE.equals(entity.getEnabled())) {
            throw new ActionException(ErrorCode.STATE_CONFLICT, "触发器已启用");
        }
        entity.setEnabled(Boolean.TRUE);
        entity.setUpdatedBy(currentOperator());
        entity.setUpdatedAt(Instant.now());
        return toResponse(actionTriggerRepository.save(entity));
    }

    @Transactional
    public TriggerResponse disable(String triggerId) {
        ActionTriggerEntity entity = findByTriggerId(triggerId);
        if (Boolean.FALSE.equals(entity.getEnabled())) {
            throw new ActionException(ErrorCode.STATE_CONFLICT, "触发器已禁用");
        }
        entity.setEnabled(Boolean.FALSE);
        entity.setUpdatedBy(currentOperator());
        entity.setUpdatedAt(Instant.now());
        return toResponse(actionTriggerRepository.save(entity));
    }

    @Transactional
    public SyncExecutionResponse fire(String triggerId) {
        ActionTriggerEntity entity = findByTriggerId(triggerId);
        return fire(entity);
    }

    SyncExecutionResponse fire(ActionTriggerEntity trigger) {
        String previousTenant = TenantContext.get();
        try {
            TenantContext.set(trigger.getTenantId());
            TraceContext.getOrCreate();
            ActionDefinitionEntity action = actionDefinitionRepository
                    .findByTenantIdAndActionIdAndDeletedAtIsNull(trigger.getTenantId(), trigger.getActionId())
                    .orElseThrow(() -> new ActionException(ErrorCode.ACTION_NOT_FOUND,
                            "Action 不存在: " + trigger.getActionId()));
            SyncExecutionRequest request = new SyncExecutionRequest();
            request.setActionCode(action.getCode());
            return httpExecutionService.executeSync(request);
        } finally {
            if (previousTenant == null) {
                TenantContext.clear();
            } else {
                TenantContext.set(previousTenant);
            }
        }
    }

    ActionTriggerEntity findByTriggerId(String triggerId) {
        String tenantId = TenantContext.getOrDefault();
        return actionTriggerRepository.findByTenantIdAndTriggerIdAndDeletedAtIsNull(tenantId, triggerId)
                .orElseThrow(() -> new ActionException(ErrorCode.TRIGGER_NOT_FOUND, "触发器不存在"));
    }

    private void validateTriggerType(String triggerType, String eventTopic, String cronExpression) {
        if (triggerType == null || triggerType.isBlank()) {
            throw new ActionException(ErrorCode.INVALID_PARAM, "triggerType 不能为空");
        }
        switch (triggerType) {
            case ActionTriggerEntity.TYPE_EVENT -> {
                if (eventTopic == null || eventTopic.isBlank()) {
                    throw new ActionException(ErrorCode.INVALID_PARAM, "EVENT 触发器必须指定 eventTopic");
                }
            }
            case ActionTriggerEntity.TYPE_SCHEDULE -> {
                if (cronExpression == null || cronExpression.isBlank()) {
                    throw new ActionException(ErrorCode.INVALID_PARAM, "SCHEDULE 触发器必须指定 cronExpression");
                }
            }
            case ActionTriggerEntity.TYPE_MANUAL -> {
                // no extra fields required
            }
            default -> throw new ActionException(ErrorCode.INVALID_PARAM,
                    "triggerType 非法: " + triggerType + "，允许: EVENT/SCHEDULE/MANUAL");
        }
    }

    private void validateActionExists(String tenantId, String actionId) {
        if (actionId == null || actionId.isBlank()) {
            throw new ActionException(ErrorCode.INVALID_PARAM, "actionId 不能为空");
        }
        actionDefinitionRepository.findByTenantIdAndActionIdAndDeletedAtIsNull(tenantId, actionId)
                .orElseThrow(() -> new ActionException(ErrorCode.ACTION_NOT_FOUND, "Action 不存在: " + actionId));
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

    private TriggerResponse toResponse(ActionTriggerEntity entity) {
        return TriggerResponse.builder()
                .triggerId(entity.getTriggerId())
                .actionId(entity.getActionId())
                .name(entity.getName())
                .triggerType(entity.getTriggerType())
                .eventTopic(entity.getEventTopic())
                .cronExpression(entity.getCronExpression())
                .config(entity.getConfig())
                .enabled(entity.getEnabled())
                .createdBy(entity.getCreatedBy())
                .updatedBy(entity.getUpdatedBy())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }

    private TriggerListItem toListItem(ActionTriggerEntity entity) {
        return TriggerListItem.builder()
                .triggerId(entity.getTriggerId())
                .actionId(entity.getActionId())
                .name(entity.getName())
                .triggerType(entity.getTriggerType())
                .enabled(entity.getEnabled())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }

    private String currentOperator() {
        return "system";
    }
}
