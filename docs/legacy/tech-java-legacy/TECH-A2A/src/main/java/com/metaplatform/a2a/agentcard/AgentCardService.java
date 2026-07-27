package com.metaplatform.a2a.agentcard;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.a2a.audit.AuditService;
import com.metaplatform.a2a.common.PageResponse;
import com.metaplatform.a2a.entity.AgentCardEntity;
import com.metaplatform.a2a.events.EventType;
import com.metaplatform.a2a.events.OutboxService;
import com.metaplatform.a2a.event.AgentCardChangedEvent;
import com.metaplatform.a2a.exception.A2aException;
import com.metaplatform.a2a.repository.AgentCardRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Agent Card 服务。
 *
 * <p>对应 Python {@code app.agent_card.service.AgentCardService}。
 * 提供 Agent Card 的 CRUD 操作与 A2A 协议兼容的公开查询。</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AgentCardService {

    private final AgentCardRepository cardRepository;
    private final ObjectMapper objectMapper;
    private final AuditService auditService;
    private final OutboxService outboxService;
    private final ApplicationEventPublisher eventPublisher;

    /**
     * 创建 Agent Card。
     */
    @Transactional
    public Map<String, Object> create(String tenantId, AgentCardRequest request, String actorId) {
        if (cardRepository.existsByTenantIdAndName(tenantId, request.getName())) {
            throw A2aException.duplicateCard(request.getName());
        }

        AgentCardEntity entity = new AgentCardEntity();
        entity.setId(UUID.randomUUID().toString().replace("-", ""));
        entity.setTenantId(tenantId);
        entity.setName(request.getName());
        entity.setDescription(request.getDescription() != null ? request.getDescription() : "");
        entity.setVersion(request.getVersion() != null ? request.getVersion() : "1.0.0");
        entity.setProtocolVersion(request.getProtocolVersion() != null
                ? request.getProtocolVersion() : "0.3.0");
        entity.setCapabilities(toJson(request.getCapabilities(), "[]"));
        entity.setEndpoints(toJson(request.getEndpoints(), "{}"));
        entity.setAuthentication(toJson(request.getAuthentication(), "{}"));
        entity.setMetadata(toJson(request.getMetadata(), "{}"));
        entity.setStatus(request.getStatus() != null ? request.getStatus() : "PUBLISHED");

        AgentCardEntity saved = cardRepository.save(entity);

        // 审计日志 + 事件
        auditService.record(AuditService.ACTION_CARD_CREATED, actorId,
                saved.getId(), Map.of("name", saved.getName()));
        outboxService.recordEvent(EventType.CARD_CREATED, toEventPayload(saved));
        eventPublisher.publishEvent(new AgentCardChangedEvent(
                saved, AgentCardChangedEvent.ChangeType.CREATED));

        return toResponse(saved);
    }

    /**
     * 更新 Agent Card。
     */
    @Transactional
    public Map<String, Object> update(String tenantId, String cardId,
                                       AgentCardRequest request, String actorId) {
        AgentCardEntity entity = cardRepository.findByIdAndTenantId(cardId, tenantId)
                .orElseThrow(() -> A2aException.cardNotFound(cardId));

        if (request.getName() != null && !request.getName().equals(entity.getName())) {
            if (cardRepository.existsByTenantIdAndName(tenantId, request.getName())) {
                throw A2aException.duplicateCard(request.getName());
            }
            entity.setName(request.getName());
        }
        if (request.getDescription() != null) {
            entity.setDescription(request.getDescription());
        }
        if (request.getVersion() != null) {
            entity.setVersion(request.getVersion());
        }
        if (request.getProtocolVersion() != null) {
            entity.setProtocolVersion(request.getProtocolVersion());
        }
        if (request.getCapabilities() != null) {
            entity.setCapabilities(toJson(request.getCapabilities(), "[]"));
        }
        if (request.getEndpoints() != null) {
            entity.setEndpoints(toJson(request.getEndpoints(), "{}"));
        }
        if (request.getAuthentication() != null) {
            entity.setAuthentication(toJson(request.getAuthentication(), "{}"));
        }
        if (request.getMetadata() != null) {
            entity.setMetadata(toJson(request.getMetadata(), "{}"));
        }
        if (request.getStatus() != null) {
            entity.setStatus(request.getStatus());
        }

        AgentCardEntity saved = cardRepository.save(entity);

        auditService.record(AuditService.ACTION_CARD_UPDATED, actorId,
                saved.getId(), Map.of("name", saved.getName()));
        outboxService.recordEvent(EventType.CARD_UPDATED, toEventPayload(saved));
        eventPublisher.publishEvent(new AgentCardChangedEvent(
                saved, AgentCardChangedEvent.ChangeType.UPDATED));

        return toResponse(saved);
    }

    /**
     * 查询 Card 详情。
     */
    @Transactional(readOnly = true)
    public Map<String, Object> get(String tenantId, String cardId) {
        AgentCardEntity entity = cardRepository.findByIdAndTenantId(cardId, tenantId)
                .orElseThrow(() -> A2aException.cardNotFound(cardId));
        return toResponse(entity);
    }

    /**
     * Card 列表（分页 + 状态过滤）。
     */
    @Transactional(readOnly = true)
    public PageResponse<Map<String, Object>> list(
            String tenantId, String status, int page, int pageSize) {
        PageRequest pageRequest = PageRequest.of(page - 1, pageSize,
                Sort.by(Sort.Direction.ASC, "createdAt"));
        Page<AgentCardEntity> result = (status != null && !status.isBlank())
                ? cardRepository.findByTenantIdAndStatus(tenantId, status, pageRequest)
                : cardRepository.findByTenantId(tenantId, pageRequest);
        List<Map<String, Object>> items = result.getContent().stream()
                .map(this::toResponse).toList();
        return PageResponse.of(items, result.getTotalElements(), page, pageSize);
    }

    /**
     * 删除 Agent Card。
     */
    @Transactional
    public boolean delete(String tenantId, String cardId, String actorId) {
        AgentCardEntity entity = cardRepository.findByIdAndTenantId(cardId, tenantId)
                .orElseThrow(() -> A2aException.cardNotFound(cardId));
        cardRepository.delete(entity);

        auditService.record(AuditService.ACTION_CARD_DELETED, actorId,
                cardId, Map.of("name", entity.getName()));
        outboxService.recordEvent(EventType.CARD_DELETED, toEventPayload(entity));
        eventPublisher.publishEvent(new AgentCardChangedEvent(
                entity, AgentCardChangedEvent.ChangeType.DELETED));
        return true;
    }

    /**
     * 公开查询：按 name 查询已发布的 Card（用于 A2A .well-known/agent.json）。
     *
     * <p>不强制租户隔离，用于跨租户 Agent 发现。</p>
     */
    @Transactional(readOnly = true)
    public Map<String, Object> findPublicByName(String name) {
        // 遍历所有租户查找已发布的 card
        List<AgentCardEntity> all = cardRepository.findAll();
        for (AgentCardEntity e : all) {
            if (e.getName().equals(name) && "PUBLISHED".equals(e.getStatus())) {
                return toResponse(e);
            }
        }
        throw A2aException.cardNotFound("name=" + name);
    }

    // ----------------------------------------------------------- helpers

    private String toJson(Object obj, String defaultValue) {
        if (obj == null) {
            return defaultValue;
        }
        try {
            return objectMapper.writeValueAsString(obj);
        } catch (JsonProcessingException ex) {
            log.warn("序列化失败，降级为默认值 | default={}", defaultValue);
            return defaultValue;
        }
    }

    private Map<String, Object> toResponse(AgentCardEntity entity) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", entity.getId());
        result.put("tenantId", entity.getTenantId());
        result.put("name", entity.getName());
        result.put("description", entity.getDescription());
        result.put("version", entity.getVersion());
        result.put("protocolVersion", entity.getProtocolVersion());
        result.put("capabilities", parseJson(entity.getCapabilities(), List.class));
        result.put("endpoints", parseJson(entity.getEndpoints(), Map.class));
        result.put("authentication", parseJson(entity.getAuthentication(), Map.class));
        result.put("metadata", parseJson(entity.getMetadata(), Map.class));
        result.put("status", entity.getStatus());
        result.put("createdAt", entity.getCreatedAt());
        result.put("updatedAt", entity.getUpdatedAt());
        return result;
    }

    @SuppressWarnings("unchecked")
    private <T> T parseJson(String json, Class<?> type) {
        if (json == null || json.isBlank()) {
            return (T) (type == Map.class ? Map.of() : List.of());
        }
        try {
            if (type == Map.class) {
                return (T) objectMapper.readValue(json, Map.class);
            } else {
                return (T) objectMapper.readValue(json, List.class);
            }
        } catch (Exception e) {
            return (T) (type == Map.class ? Map.of() : List.of());
        }
    }

    private Map<String, Object> toEventPayload(AgentCardEntity entity) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("cardId", entity.getId());
        payload.put("tenantId", entity.getTenantId());
        payload.put("name", entity.getName());
        payload.put("version", entity.getVersion());
        payload.put("status", entity.getStatus());
        return payload;
    }
}
