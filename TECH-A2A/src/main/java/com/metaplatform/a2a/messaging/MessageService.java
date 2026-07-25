package com.metaplatform.a2a.messaging;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.a2a.audit.AuditService;
import com.metaplatform.a2a.common.PageResponse;
import com.metaplatform.a2a.entity.AgentMessageEntity;
import com.metaplatform.a2a.events.EventType;
import com.metaplatform.a2a.events.OutboxService;
import com.metaplatform.a2a.exception.A2aException;
import com.metaplatform.a2a.repository.AgentMessageRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.time.format.DateTimeParseException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Agent 间消息服务。
 *
 * <p>对应 Python {@code app.messaging.service.MessageService}。
 * 提供消息的发送 / 接收 / 确认 / 队列拉取 / 过期清理能力。</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MessageService {

    public static final String STATUS_PENDING = "PENDING";
    public static final String STATUS_DELIVERED = "DELIVERED";
    public static final String STATUS_ACKED = "ACKED";
    public static final String STATUS_EXPIRED = "EXPIRED";

    private final AgentMessageRepository messageRepository;
    private final ObjectMapper objectMapper;
    private final AuditService auditService;
    private final OutboxService outboxService;

    /**
     * 发送消息。
     */
    @Transactional
    public Map<String, Object> send(String tenantId, SendMessageRequest request) {
        AgentMessageEntity entity = new AgentMessageEntity();
        entity.setId(UUID.randomUUID().toString().replace("-", ""));
        entity.setTenantId(tenantId);
        entity.setFromAgentId(request.getFromAgentId());
        entity.setToAgentId(request.getToAgentId());
        entity.setMessageType(request.getMessageType() != null ? request.getMessageType() : "text");
        entity.setContent(toJson(request.getContent(), "{}"));
        entity.setStatus(STATUS_PENDING);
        if (request.getExpiresAt() != null && !request.getExpiresAt().isBlank()) {
            try {
                entity.setExpiresAt(OffsetDateTime.parse(request.getExpiresAt()));
            } catch (DateTimeParseException e) {
                log.warn("expiresAt 解析失败 | value={}", request.getExpiresAt());
            }
        }

        AgentMessageEntity saved = messageRepository.save(entity);

        auditService.record(AuditService.ACTION_MESSAGE_SENT,
                request.getFromAgentId(), saved.getId(),
                Map.of("to", request.getToAgentId()));
        outboxService.recordEvent(EventType.MESSAGE_SENT, toEventPayload(saved));

        return toResponse(saved);
    }

    /**
     * 查询消息详情。
     */
    @Transactional(readOnly = true)
    public Map<String, Object> get(String tenantId, String messageId) {
        AgentMessageEntity entity = messageRepository
                .findByIdAndTenantId(messageId, tenantId)
                .orElseThrow(() -> A2aException.messageNotFound(messageId));
        return toResponse(entity);
    }

    /**
     * 收件箱（分页）。
     */
    @Transactional(readOnly = true)
    public PageResponse<Map<String, Object>> inbox(
            String tenantId, String agentId, int page, int pageSize) {
        PageRequest pageRequest = PageRequest.of(page - 1, pageSize,
                Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<AgentMessageEntity> result =
                messageRepository.findByTenantIdAndToAgentId(tenantId, agentId, pageRequest);
        List<Map<String, Object>> items = result.getContent().stream()
                .map(this::toResponse).toList();
        return PageResponse.of(items, result.getTotalElements(), page, pageSize);
    }

    /**
     * 发件箱（分页）。
     */
    @Transactional(readOnly = true)
    public PageResponse<Map<String, Object>> outbox(
            String tenantId, String agentId, int page, int pageSize) {
        PageRequest pageRequest = PageRequest.of(page - 1, pageSize,
                Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<AgentMessageEntity> result =
                messageRepository.findByTenantIdAndFromAgentId(tenantId, agentId, pageRequest);
        List<Map<String, Object>> items = result.getContent().stream()
                .map(this::toResponse).toList();
        return PageResponse.of(items, result.getTotalElements(), page, pageSize);
    }

    /**
     * 确认消息。
     */
    @Transactional
    public boolean acknowledge(String tenantId, String messageId, String actorId) {
        AgentMessageEntity entity = messageRepository
                .findByIdAndTenantId(messageId, tenantId)
                .orElseThrow(() -> A2aException.messageNotFound(messageId));

        entity.setStatus(STATUS_ACKED);
        entity.setAcknowledgedAt(OffsetDateTime.now());
        messageRepository.save(entity);

        auditService.record(AuditService.ACTION_MESSAGE_ACKED, actorId, messageId, Map.of());
        return true;
    }

    /**
     * 拉取待处理消息队列（按 toAgentId 过滤的 PENDING 消息）。
     */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> queue(String tenantId, String agentId) {
        List<AgentMessageEntity> messages =
                messageRepository.findByTenantIdAndToAgentIdAndStatus(
                        tenantId, agentId, STATUS_PENDING);
        return messages.stream().map(this::toResponse).toList();
    }

    /**
     * 清理过期消息。
     */
    @Transactional
    public Map<String, Object> cleanupExpired(String tenantId) {
        OffsetDateTime now = OffsetDateTime.now();
        List<AgentMessageEntity> expired = messageRepository
                .findByTenantIdAndStatusAndExpiresAtBefore(tenantId, STATUS_PENDING, now);

        int count = 0;
        for (AgentMessageEntity e : expired) {
            e.setStatus(STATUS_EXPIRED);
            messageRepository.save(e);
            count++;
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("cleaned", count);
        result.put("timestamp", now);
        return result;
    }

    // ----------------------------------------------------------- helpers

    private String toJson(Object obj, String defaultValue) {
        if (obj == null) {
            return defaultValue;
        }
        try {
            return objectMapper.writeValueAsString(obj);
        } catch (JsonProcessingException ex) {
            return defaultValue;
        }
    }

    private Map<String, Object> toResponse(AgentMessageEntity entity) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", entity.getId());
        result.put("tenantId", entity.getTenantId());
        result.put("fromAgentId", entity.getFromAgentId());
        result.put("toAgentId", entity.getToAgentId());
        result.put("messageType", entity.getMessageType());
        result.put("content", parseJson(entity.getContent()));
        result.put("status", entity.getStatus());
        result.put("acknowledgedAt", entity.getAcknowledgedAt());
        result.put("expiresAt", entity.getExpiresAt());
        result.put("createdAt", entity.getCreatedAt());
        result.put("updatedAt", entity.getUpdatedAt());
        return result;
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> parseJson(String json) {
        if (json == null || json.isBlank()) {
            return Map.of();
        }
        try {
            return objectMapper.readValue(json, Map.class);
        } catch (Exception e) {
            return Map.of();
        }
    }

    private Map<String, Object> toEventPayload(AgentMessageEntity entity) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("messageId", entity.getId());
        payload.put("tenantId", entity.getTenantId());
        payload.put("fromAgentId", entity.getFromAgentId());
        payload.put("toAgentId", entity.getToAgentId());
        payload.put("messageType", entity.getMessageType());
        return payload;
    }
}
