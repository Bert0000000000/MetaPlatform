package com.metaplatform.agent.conversations;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.agent.common.ErrorCode;
import com.metaplatform.agent.entity.AgentConversationEntity;
import com.metaplatform.agent.entity.AgentDefinitionEntity;
import com.metaplatform.agent.entity.AgentMessageEntity;
import com.metaplatform.agent.exception.AgentException;
import com.metaplatform.agent.execution.ExecuteContext;
import com.metaplatform.agent.execution.ExecuteRequest;
import com.metaplatform.agent.execution.ExecuteResponse;
import com.metaplatform.agent.execution.ExecutionService;
import com.metaplatform.agent.repository.AgentConversationRepository;
import com.metaplatform.agent.repository.AgentDefinitionRepository;
import com.metaplatform.agent.repository.AgentMessageRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * 对话服务：创建、发送消息、流式消息、列表、历史、结束。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ConversationService {

    private static final TypeReference<Map<String, Object>> MAP_TYPE = new TypeReference<>() {};

    private final AgentConversationRepository conversationRepository;
    private final AgentMessageRepository messageRepository;
    private final AgentDefinitionRepository agentDefinitionRepository;
    private final ExecutionService executionService;
    private final ObjectMapper objectMapper;

    /**
     * 创建会话。
     */
    @Transactional
    public ConversationResponse create(String tenantId, String agentId, String title, String mode) {
        // 校验 Agent 存在
        AgentDefinitionEntity agent = agentDefinitionRepository
                .findByIdAndTenantIdAndDeletedAtIsNull(agentId, tenantId)
                .orElseThrow(() -> AgentException.agentNotFound(agentId));

        AgentConversationEntity entity = new AgentConversationEntity();
        entity.setId("conv-" + UUID.randomUUID().toString().replace("-", "").substring(0, 12));
        entity.setTenantId(tenantId);
        entity.setAgentId(agent.getId());
        entity.setTitle(title == null ? "" : title);
        entity.setStatus("ACTIVE");
        entity.setMessageCount(0);
        entity.setFavorite(false);
        entity.setMode(mode == null || mode.isBlank() ? "chat" : mode);

        AgentConversationEntity saved = conversationRepository.save(entity);
        return toResponse(saved);
    }

    /**
     * 获取会话详情。
     */
    @Transactional(readOnly = true)
    public ConversationResponse get(String tenantId, String conversationId) {
        AgentConversationEntity entity = conversationRepository
                .findByIdAndTenantId(conversationId, tenantId)
                .orElseThrow(() -> new AgentException(ErrorCode.CONVERSATION_NOT_FOUND,
                        "会话不存在: conversationId=" + conversationId));
        return toResponse(entity);
    }

    /**
     * 列出会话（分页）。
     */
    @Transactional(readOnly = true)
    public Page<ConversationResponse> list(String tenantId,
                                           String agentId,
                                           Boolean favorite,
                                           int page,
                                           int pageSize) {
        PageRequest pageRequest = PageRequest.of(page - 1, pageSize,
                Sort.by(Sort.Direction.DESC, "updatedAt"));

        Page<AgentConversationEntity> entities;
        if (agentId != null && !agentId.isBlank()) {
            entities = conversationRepository.findByTenantIdAndAgentId(tenantId, agentId, pageRequest);
        } else if (favorite != null) {
            entities = conversationRepository.findByTenantIdAndFavorite(tenantId, favorite, pageRequest);
        } else {
            entities = conversationRepository.findByTenantId(tenantId, pageRequest);
        }
        return entities.map(this::toResponse);
    }

    /**
     * 切换收藏状态。
     */
    @Transactional
    public ConversationResponse toggleFavorite(String tenantId, String conversationId) {
        AgentConversationEntity entity = conversationRepository
                .findByIdAndTenantId(conversationId, tenantId)
                .orElseThrow(() -> new AgentException(ErrorCode.CONVERSATION_NOT_FOUND,
                        "会话不存在: conversationId=" + conversationId));
        entity.setFavorite(!Boolean.TRUE.equals(entity.getFavorite()));
        AgentConversationEntity saved = conversationRepository.save(entity);
        return toResponse(saved);
    }

    /**
     * 发送消息（同步）。
     */
    @Transactional
    public MessageResponse sendMessage(String tenantId, String conversationId,
                                       SendMessageRequest request, String traceId) {
        AgentConversationEntity conv = conversationRepository
                .findByIdAndTenantId(conversationId, tenantId)
                .orElseThrow(() -> new AgentException(ErrorCode.CONVERSATION_NOT_FOUND,
                        "会话不存在: conversationId=" + conversationId));

        if ("ENDED".equals(conv.getStatus())) {
            throw new AgentException(ErrorCode.INVALID_PARAM,
                    "会话已结束，无法发送消息");
        }

        // 保存用户消息
        addMessage(conversationId, tenantId, "user", request.getContent(), request.getMetadata());

        // 通过执行引擎执行
        ExecuteRequest execRequest = ExecuteRequest.builder()
                .input(request.getContent())
                .context(ExecuteContext.builder().conversationId(conversationId).build())
                .build();
        ExecuteResponse response = executionService.execute(tenantId, conv.getAgentId(), execRequest, traceId);

        // 保存助手响应
        Map<String, Object> assistantMeta = new LinkedHashMap<>();
        assistantMeta.put("executionId", response.getExecutionId());
        assistantMeta.put("traceId", traceId);
        AgentMessageEntity assistantMsg = addMessage(conversationId, tenantId, "assistant",
                response.getOutput().getContent(), assistantMeta);

        // 更新会话消息计数和最后消息时间
        conv.setMessageCount(conv.getMessageCount() + 2);
        conv.setLastMessageAt(OffsetDateTime.now());
        conversationRepository.save(conv);

        return toMessageResponse(assistantMsg);
    }

    /**
     * 流式发送消息，返回事件列表。
     */
    @Transactional
    public List<Map<String, Object>> streamMessage(String tenantId, String conversationId,
                                                   SendMessageRequest request, String traceId) {
        AgentConversationEntity conv = conversationRepository
                .findByIdAndTenantId(conversationId, tenantId)
                .orElseThrow(() -> new AgentException(ErrorCode.CONVERSATION_NOT_FOUND,
                        "会话不存在: conversationId=" + conversationId));

        if ("ENDED".equals(conv.getStatus())) {
            throw new AgentException(ErrorCode.INVALID_PARAM,
                    "会话已结束，无法发送消息");
        }

        // 保存用户消息
        addMessage(conversationId, tenantId, "user", request.getContent(), request.getMetadata());

        // 流式执行
        ExecuteRequest execRequest = ExecuteRequest.builder()
                .input(request.getContent())
                .context(ExecuteContext.builder().conversationId(conversationId).build())
                .build();
        List<Map<String, Object>> events = executionService.stream(tenantId, conv.getAgentId(), execRequest, traceId);

        // 从 content.done 事件中提取完整内容
        String fullContent = "";
        for (Map<String, Object> event : events) {
            if ("content.done".equals(event.get("event"))) {
                Object data = event.get("data");
                if (data instanceof Map<?, ?> dataMap) {
                    Object content = dataMap.get("content");
                    fullContent = content == null ? "" : content.toString();
                }
            }
        }

        // 保存助手响应
        if (!fullContent.isBlank()) {
            Map<String, Object> meta = new LinkedHashMap<>();
            meta.put("traceId", traceId);
            addMessage(conversationId, tenantId, "assistant", fullContent, meta);
        }

        // 更新会话消息计数和最后消息时间
        conv.setMessageCount(conv.getMessageCount() + 2);
        conv.setLastMessageAt(OffsetDateTime.now());
        conversationRepository.save(conv);

        return events;
    }

    /**
     * 获取消息历史（分页）。
     */
    @Transactional(readOnly = true)
    public Page<MessageResponse> getHistory(String tenantId, String conversationId, int page, int pageSize) {
        // 先校验会话存在
        conversationRepository.findByIdAndTenantId(conversationId, tenantId)
                .orElseThrow(() -> new AgentException(ErrorCode.CONVERSATION_NOT_FOUND,
                        "会话不存在: conversationId=" + conversationId));

        PageRequest pageRequest = PageRequest.of(page - 1, pageSize,
                Sort.by(Sort.Direction.ASC, "createdAt"));
        Page<AgentMessageEntity> messages = messageRepository
                .findByTenantIdAndConversationId(tenantId, conversationId, pageRequest);
        return messages.map(this::toMessageResponse);
    }

    /**
     * 结束会话。
     */
    @Transactional
    public ConversationResponse endConversation(String tenantId, String conversationId) {
        AgentConversationEntity entity = conversationRepository
                .findByIdAndTenantId(conversationId, tenantId)
                .orElseThrow(() -> new AgentException(ErrorCode.CONVERSATION_NOT_FOUND,
                        "会话不存在: conversationId=" + conversationId));
        if ("ENDED".equals(entity.getStatus())) {
            return toResponse(entity);
        }
        entity.setStatus("ENDED");
        AgentConversationEntity saved = conversationRepository.save(entity);
        return toResponse(saved);
    }

    // ----------------------------------------------------------- helpers

    private AgentMessageEntity addMessage(String conversationId, String tenantId,
                                         String role, String content, Map<String, Object> metadata) {
        AgentMessageEntity msg = new AgentMessageEntity();
        msg.setId("msg-" + UUID.randomUUID().toString().replace("-", "").substring(0, 12));
        msg.setConversationId(conversationId);
        msg.setTenantId(tenantId);
        msg.setRole(role);
        msg.setContent(content);
        msg.setMetadata(toJson(metadata));
        return messageRepository.save(msg);
    }

    private ConversationResponse toResponse(AgentConversationEntity entity) {
        return ConversationResponse.builder()
                .id(entity.getId())
                .conversationId(entity.getId())
                .tenantId(entity.getTenantId())
                .agentId(entity.getAgentId())
                .title(entity.getTitle())
                .status(entity.getStatus())
                .messageCount(entity.getMessageCount())
                .favorite(entity.getFavorite())
                .mode(entity.getMode())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .lastMessageAt(entity.getLastMessageAt())
                .preview("")
                .build();
    }

    private MessageResponse toMessageResponse(AgentMessageEntity entity) {
        return MessageResponse.builder()
                .messageId(entity.getId())
                .conversationId(entity.getConversationId())
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
