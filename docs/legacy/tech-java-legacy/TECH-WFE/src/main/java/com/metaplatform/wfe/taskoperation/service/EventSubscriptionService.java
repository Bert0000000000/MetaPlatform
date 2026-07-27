package com.metaplatform.wfe.taskoperation.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.wfe.common.ErrorCode;
import com.metaplatform.wfe.common.TenantContext;
import com.metaplatform.wfe.exception.WfeException;
import com.metaplatform.wfe.taskoperation.dto.EventSubscriptionRequest;
import com.metaplatform.wfe.taskoperation.dto.EventSubscriptionResponse;
import com.metaplatform.wfe.taskoperation.entity.EventSubscriptionEntity;
import com.metaplatform.wfe.taskoperation.repository.EventSubscriptionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class EventSubscriptionService {

    private final EventSubscriptionRepository repository;
    private final ObjectMapper objectMapper;

    @Transactional
    public EventSubscriptionResponse create(EventSubscriptionRequest request) {
        String tenantId = TenantContext.get();
        String userId = TenantContext.getUserId();
        if (userId == null) {
            throw new WfeException(ErrorCode.UNAUTHORIZED, "未识别用户，无法订阅事件");
        }
        Instant now = Instant.now();
        EventSubscriptionEntity entity;
        try {
            entity = EventSubscriptionEntity.builder()
                    .id(UUID.randomUUID().toString())
                    .tenantId(tenantId)
                    .userId(userId)
                    .eventTypes(objectMapper.writeValueAsString(request.getEventTypes()))
                    .callbackUrl(request.getCallbackUrl())
                    .enabled(request.getEnabled() == null ? Boolean.TRUE : request.getEnabled())
                    .createdAt(now)
                    .updatedAt(now)
                    .build();
        } catch (Exception e) {
            throw new WfeException(ErrorCode.INVALID_PARAM, "eventTypes 序列化失败");
        }
        return toResponse(repository.save(entity));
    }

    @Transactional(readOnly = true)
    public List<EventSubscriptionResponse> listMine() {
        String tenantId = TenantContext.get();
        String userId = TenantContext.getUserId();
        if (userId == null) {
            return List.of();
        }
        return repository.findByTenantIdAndUserId(tenantId, userId).stream()
                .map(this::toResponse).toList();
    }

    @Transactional
    public void delete(String id) {
        String tenantId = TenantContext.get();
        EventSubscriptionEntity entity = repository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new WfeException(ErrorCode.EVENT_SUBSCRIPTION_NOT_FOUND, "事件订阅不存在"));
        repository.delete(entity);
    }

    private EventSubscriptionResponse toResponse(EventSubscriptionEntity entity) {
        List<String> types;
        try {
            types = objectMapper.readValue(entity.getEventTypes(), new TypeReference<>() {});
        } catch (Exception e) {
            log.warn("Failed to deserialize event types for subscription {}: {}", entity.getId(), e.getMessage());
            types = List.of();
        }
        return EventSubscriptionResponse.builder()
                .id(entity.getId())
                .userId(entity.getUserId())
                .eventTypes(types)
                .callbackUrl(entity.getCallbackUrl())
                .enabled(entity.getEnabled())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }
}