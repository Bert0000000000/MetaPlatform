package com.metaplatform.agent.memory;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.agent.common.ErrorCode;
import com.metaplatform.agent.entity.MemoryMessageEntity;
import com.metaplatform.agent.entity.MemorySessionEntity;
import com.metaplatform.agent.exception.AgentException;
import com.metaplatform.agent.repository.MemoryMessageRepository;
import com.metaplatform.agent.repository.MemorySessionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * 短期记忆服务：会话上下文管理。
 *
 * <p>内部能力，无独立 Controller，被其他模块调用。</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MemoryService {

    private static final TypeReference<Map<String, Object>> MAP_TYPE = new TypeReference<>() {};

    private final MemorySessionRepository sessionRepository;
    private final MemoryMessageRepository messageRepository;
    private final ObjectMapper objectMapper;

    /**
     * 创建记忆会话。
     */
    @Transactional
    public MemorySessionResponse createSession(String tenantId, String agentId, String title) {
        MemorySessionEntity entity = new MemorySessionEntity();
        entity.setSessionId("mem-" + UUID.randomUUID().toString().replace("-", "").substring(0, 12));
        entity.setTenantId(tenantId);
        entity.setAgentId(agentId);
        entity.setTitle(title == null ? "" : title);
        entity.setMessageCount(0);
        MemorySessionEntity saved = sessionRepository.save(entity);
        return toSessionResponse(saved);
    }

    /**
     * 添加记忆消息。
     */
    @Transactional
    public MemoryMessageResponse addMessage(String tenantId, String sessionId, String agentId,
                                            String role, String content, Map<String, Object> metadata) {
        MemorySessionEntity session = sessionRepository
                .findBySessionIdAndTenantId(sessionId, tenantId)
                .orElseThrow(() -> new AgentException(ErrorCode.INVALID_PARAM,
                        "会话不存在: sessionId=" + sessionId));

        MemoryMessageEntity entity = new MemoryMessageEntity();
        entity.setId("mm-" + UUID.randomUUID().toString().replace("-", "").substring(0, 12));
        entity.setSessionId(sessionId);
        entity.setTenantId(tenantId);
        entity.setAgentId(agentId);
        entity.setRole(role);
        entity.setContent(content);
        entity.setMetadata(toJson(metadata));
        MemoryMessageEntity saved = messageRepository.save(entity);

        // 更新会话计数和最后消息时间
        session.setMessageCount(session.getMessageCount() + 1);
        session.setLastMessageAt(OffsetDateTime.now());
        sessionRepository.save(session);

        return toMessageResponse(saved);
    }

    /**
     * 获取记忆上下文（最近 N 条消息）。
     */
    @Transactional(readOnly = true)
    public List<MemoryMessageResponse> getContext(String tenantId, String sessionId, int maxMessages) {
        List<MemoryMessageEntity> messages = messageRepository
                .findByTenantIdAndSessionId(tenantId, sessionId);
        int size = Math.min(maxMessages, messages.size());
        int start = messages.size() - size;
        return messages.subList(start, messages.size()).stream()
                .map(this::toMessageResponse)
                .toList();
    }

    /**
     * 清空会话记忆。
     */
    @Transactional
    public boolean clearSession(String tenantId, String sessionId) {
        MemorySessionEntity session = sessionRepository
                .findBySessionIdAndTenantId(sessionId, tenantId)
                .orElse(null);
        if (session == null) {
            return false;
        }
        List<MemoryMessageEntity> messages = messageRepository
                .findByTenantIdAndSessionId(tenantId, sessionId);
        messageRepository.deleteAll(messages);
        session.setMessageCount(0);
        sessionRepository.save(session);
        return true;
    }

    /**
     * 列出 Agent 的记忆会话。
     */
    @Transactional(readOnly = true)
    public List<MemorySessionResponse> listSessions(String tenantId, String agentId) {
        return sessionRepository
                .findByTenantIdAndAgentId(tenantId, agentId, PageRequest.of(0, 200))
                .getContent()
                .stream()
                .map(this::toSessionResponse)
                .toList();
    }

    // ----------------------------------------------------------- helpers

    private MemorySessionResponse toSessionResponse(MemorySessionEntity entity) {
        return MemorySessionResponse.builder()
                .sessionId(entity.getSessionId())
                .agentId(entity.getAgentId())
                .tenantId(entity.getTenantId())
                .title(entity.getTitle())
                .messageCount(entity.getMessageCount())
                .lastMessageAt(entity.getLastMessageAt())
                .createdAt(entity.getCreatedAt())
                .build();
    }

    private MemoryMessageResponse toMessageResponse(MemoryMessageEntity entity) {
        return MemoryMessageResponse.builder()
                .messageId(entity.getId())
                .sessionId(entity.getSessionId())
                .agentId(entity.getAgentId())
                .tenantId(entity.getTenantId())
                .role(entity.getRole())
                .content(entity.getContent())
                .metadata(fromJson(entity.getMetadata()))
                .createdAt(entity.getCreatedAt())
                .build();
    }

    private String toJson(Map<String, Object> map) {
        if (map == null || map.isEmpty()) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(map);
        } catch (Exception e) {
            log.warn("序列化 metadata 失败", e);
            return null;
        }
    }

    private Map<String, Object> fromJson(String json) {
        if (json == null || json.isBlank()) {
            return null;
        }
        try {
            return objectMapper.readValue(json, MAP_TYPE);
        } catch (Exception e) {
            log.warn("反序列化 JSON 失败 | json={}", json, e);
            return null;
        }
    }
}
