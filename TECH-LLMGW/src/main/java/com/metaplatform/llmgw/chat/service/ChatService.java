package com.metaplatform.llmgw.chat.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.llmgw.chat.dto.ChatMessage;
import com.metaplatform.llmgw.chat.dto.ChatRequest;
import com.metaplatform.llmgw.chat.dto.ChatResponse;
import com.metaplatform.llmgw.common.TraceContext;
import com.metaplatform.llmgw.entity.AuditLogEntity;
import com.metaplatform.llmgw.entity.CostRecordEntity;
import com.metaplatform.llmgw.repository.AuditLogEntityRepository;
import com.metaplatform.llmgw.repository.CostRecordEntityRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.messages.Message;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.prompt.ChatOptions;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.ai.tool.ToolCallback;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ChatService {

    private final ChatModel chatModel;
    private final ChatClient.Builder chatClientBuilder;
    private final ChatMessageConverter chatMessageConverter;
    private final AuditLogEntityRepository auditLogRepository;
    private final CostRecordEntityRepository costRecordRepository;
    private final ObjectMapper objectMapper;

    public Flux<String> streamChat(String systemPrompt, String userMessage) {
        return chatClientBuilder.build()
            .prompt()
            .system(systemPrompt)
            .user(userMessage)
            .stream()
            .content();
    }

    public String chatWithFunctions(String systemPrompt, String userMessage, ToolCallback[] tools) {
        org.springframework.ai.chat.model.ChatResponse response = chatClientBuilder.build()
            .prompt()
            .system(systemPrompt)
            .user(userMessage)
            .toolCallbacks(tools)
            .call()
            .chatResponse();
        return response.getResult().getOutput().getText();
    }

    public ChatResponse chat(ChatRequest request) {
        Instant start = Instant.now();
        String requestId = UUID.randomUUID().toString();
        String model = request.model();
        String traceId = TraceContext.getTraceId();
        String userId = extractUserId(request.metadata());
        String appId = extractAppId(request.metadata());
        org.springframework.ai.chat.model.ChatResponse springResponse = null;
        ChatResponse response = null;
        Exception exception = null;

        try {
            List<Message> messages = chatMessageConverter.toSpringAiMessages(request.messages());
            ChatOptions options = ChatOptions.builder()
                .model(request.model())
                .temperature(request.temperature())
                .topP(request.topP())
                .maxTokens(request.maxTokens())
                .stopSequences(request.stop())
                .build();
            Prompt prompt = new Prompt(messages, options);
            springResponse = chatModel.call(prompt);
            response = toChatResponse(requestId, model, springResponse);
            return response;
        } catch (Exception e) {
            exception = e;
            throw e;
        } finally {
            long latencyMs = Duration.between(start, Instant.now()).toMillis();
            saveAuditLog(requestId, traceId, userId, appId, model, request, response, springResponse, exception, latencyMs);
            if (exception == null && springResponse != null) {
                saveCostRecord(requestId, traceId, userId, appId, model, springResponse);
            }
        }
    }

    private ChatResponse toChatResponse(String id, String model, org.springframework.ai.chat.model.ChatResponse springResponse) {
        if (springResponse == null || springResponse.getResult() == null) {
            return new ChatResponse(id, model, List.of(), null, "stop");
        }
        String content = springResponse.getResult().getOutput().getText();
        ChatMessage message = new ChatMessage("assistant", content);
        ChatResponse.Choice choice = new ChatResponse.Choice(0, message, extractFinishReason(springResponse));
        org.springframework.ai.chat.metadata.Usage usage = springResponse.getMetadata().getUsage();
        ChatResponse.Usage usageDto = null;
        if (usage != null) {
            usageDto = new ChatResponse.Usage(
                toInt(usage.getPromptTokens()),
                toInt(usage.getCompletionTokens()),
                toInt(usage.getTotalTokens())
            );
        }
        return new ChatResponse(id, model, List.of(choice), usageDto, extractFinishReason(springResponse));
    }

    private String extractFinishReason(org.springframework.ai.chat.model.ChatResponse springResponse) {
        if (springResponse.getResult() != null && springResponse.getResult().getMetadata() != null) {
            Object finishReason = springResponse.getResult().getMetadata().get("finishReason");
            if (finishReason != null) {
                return finishReason.toString();
            }
        }
        return "stop";
    }

    private int toInt(Integer value) {
        return value == null ? 0 : value;
    }

    private void saveAuditLog(String requestId, String traceId, String userId, String appId, String model,
                              ChatRequest request, ChatResponse response,
                              org.springframework.ai.chat.model.ChatResponse springResponse,
                              Exception exception, long latencyMs) {
        AuditLogEntity auditLog = new AuditLogEntity();
        auditLog.setTraceId(traceId);
        auditLog.setUserId(userId);
        auditLog.setAppId(appId);
        auditLog.setModelId(model);
        auditLog.setEndpoint("/api/v1/llmgw/chat");
        auditLog.setMethod("POST");
        auditLog.setLatencyMs(latencyMs);
        auditLog.setStatusCode(exception == null ? 200 : 500);
        auditLog.setErrorMessage(exception == null ? null : exception.getMessage());
        auditLog.setRequestBody(toJson(request));
        auditLog.setResponseBody(toJson(response));
        auditLog.setMetadata(toJson(springResponse == null ? null : springResponse.getMetadata()));
        if (response != null && response.usage() != null) {
            auditLog.setInputTokens(response.usage().promptTokens());
            auditLog.setOutputTokens(response.usage().completionTokens());
            auditLog.setTotalTokens(response.usage().totalTokens());
        }
        auditLog.setCreatedAt(java.time.LocalDateTime.now());
        try { auditLogRepository.save(auditLog); } catch (Exception ignore) { /* audit log must not break the API response */ }
    }

    private void saveCostRecord(String requestId, String traceId, String userId, String appId, String model,
                                org.springframework.ai.chat.model.ChatResponse springResponse) {
        org.springframework.ai.chat.metadata.Usage usage = springResponse.getMetadata().getUsage();
        if (usage == null) {
            return;
        }
        CostRecordEntity costRecord = new CostRecordEntity();
        costRecord.setTraceId(traceId);
        costRecord.setUserId(userId);
        costRecord.setAppId(appId);
        costRecord.setModelId(model);
        costRecord.setProvider("dashscope");
        costRecord.setInputTokens(toInt(usage.getPromptTokens()));
        costRecord.setOutputTokens(toInt(usage.getCompletionTokens()));
        costRecord.setInputCost(BigDecimal.ZERO);
        costRecord.setOutputCost(BigDecimal.ZERO);
        costRecord.setTotalCost(BigDecimal.ZERO);
        costRecordRepository.save(costRecord);
    }

    private String extractUserId(Map<String, Object> metadata) {
        if (metadata == null) {
            return "anonymous";
        }
        Object userId = metadata.get("userId");
        return userId == null ? "anonymous" : userId.toString();
    }

    private String extractAppId(Map<String, Object> metadata) {
        if (metadata == null) {
            return "unknown";
        }
        Object appId = metadata.get("appId");
        return appId == null ? "unknown" : appId.toString();
    }

    private String toJson(Object value) {
        if (value == null) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException e) {
            return null;
        }
    }
}
