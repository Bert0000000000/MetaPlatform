package com.metaplatform.copilot.service;

import com.metaplatform.copilot.config.CopilotProperties;
import com.metaplatform.copilot.dto.ChatResponse;
import com.metaplatform.copilot.entity.ChatMessageEntity;
import com.metaplatform.copilot.entity.ChatSessionEntity;
import com.metaplatform.copilot.entity.SchedulingRecordEntity;
import com.metaplatform.copilot.repository.ChatMessageRepository;
import com.metaplatform.copilot.repository.ChatSessionRepository;
import com.metaplatform.copilot.repository.SchedulingRecordRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;
import java.time.LocalDateTime;
import java.util.*;

@Service
@RequiredArgsConstructor
public class ChatService {
    private final ChatSessionRepository sessionRepository;
    private final ChatMessageRepository messageRepository;
    private final SchedulingRecordRepository schedulingRepository;
    private final WebClient.Builder webClientBuilder;
    private final CopilotProperties properties;

    public ChatSessionEntity createSession(String userId, String title) {
        ChatSessionEntity session = new ChatSessionEntity();
        session.setUserId(userId);
        session.setTitle(title != null ? title : "新会话");
        return sessionRepository.save(session);
    }

    public List<ChatSessionEntity> listSessions(String userId) {
        return sessionRepository.findByUserIdOrderByLastMessageAtDesc(userId);
    }

    public ChatSessionEntity getSession(String sessionId) {
        return sessionRepository.findBySessionId(sessionId)
                .orElseThrow(() -> new IllegalStateException("会话不存在: " + sessionId));
    }

    public void deleteSession(String sessionId) {
        sessionRepository.deleteBySessionId(sessionId);
    }

    public ChatResponse sendMessage(String sessionId, String userId, String content, String businessDomain) {
        ChatSessionEntity session = getSession(sessionId);
        ChatMessageEntity userMsg = new ChatMessageEntity();
        userMsg.setSessionId(sessionId);
        userMsg.setRole("USER");
        userMsg.setContent(content);
        userMsg = messageRepository.save(userMsg);

        long start = System.currentTimeMillis();
        SchedulingRecordEntity record = new SchedulingRecordEntity();
        record.setSessionId(sessionId);
        record.setMessageId(userMsg.getMessageId());
        record.setUserId(userId);
        record.setQuery(content);
        record.setIntentType("CHAT");
        record.setBusinessDomain(businessDomain);
        record.setStatus("RUNNING");
        record = schedulingRepository.save(record);

        WebClient llmClient = webClientBuilder.clone().baseUrl(properties.getLlmgwBaseUrl()).build();
        Map<String, Object> body = Map.of(
                "sessionId", sessionId,
                "userId", userId,
                "message", content,
                "domain", businessDomain == null ? "GENERAL" : businessDomain
        );
        Mono<Map> llmResp = llmClient.post()
                .uri("/api/v1/llmgw/chat")
                .bodyValue(body)
                .retrieve()
                .bodyToMono(Map.class);

        Map<String, Object> llmData = llmResp.block();
        String assistantContent = llmData != null && llmData.get("content") != null
                ? llmData.get("content").toString()
                : "(暂无响应)";

        ChatMessageEntity assistantMsg = new ChatMessageEntity();
        assistantMsg.setSessionId(sessionId);
        assistantMsg.setRole("ASSISTANT");
        assistantMsg.setContent(assistantContent);
        assistantMsg.setCitations(llmData != null && llmData.get("citations") != null
                ? llmData.get("citations").toString() : null);
        assistantMsg.setAgentCalls(llmData != null && llmData.get("agentCalls") != null
                ? llmData.get("agentCalls").toString() : null);
        assistantMsg = messageRepository.save(assistantMsg);

        record.setLatencyMs(System.currentTimeMillis() - start);
        record.setStatus("SUCCESS");
        record.setFinishedAt(LocalDateTime.now());
        schedulingRepository.save(record);

        session.setLastMessageAt(LocalDateTime.now());
        session.setUpdatedAt(LocalDateTime.now());
        if (session.getTitle() == null || "新会话".equals(session.getTitle())) {
            String preview = content.length() > 30 ? content.substring(0, 30) : content;
            session.setTitle(preview);
        }
        sessionRepository.save(session);

        return new ChatResponse(
                sessionId,
                userMsg.getMessageId(),
                assistantMsg.getMessageId(),
                assistantContent,
                assistantMsg.getCitations() != null ? List.of(assistantMsg.getCitations()) : List.of(),
                assistantMsg.getAgentCalls() != null ? List.of(Map.of("raw", assistantMsg.getAgentCalls())) : List.of()
        );
    }

    public List<ChatMessageEntity> listMessages(String sessionId) {
        getSession(sessionId);
        return messageRepository.findBySessionIdOrderByCreatedAtAsc(sessionId);
    }

    public ChatMessageEntity submitFeedback(String messageId, Integer rating, String feedback) {
        ChatMessageEntity msg = messageRepository.findByMessageId(messageId)
                .orElseThrow(() -> new IllegalStateException("消息不存在: " + messageId));
        if (rating != null && (rating < 1 || rating > 5)) {
            throw new IllegalStateException("rating 必须在 1-5 之间");
        }
        msg.setRating(rating);
        msg.setFeedback(feedback);
        return messageRepository.save(msg);
    }
}