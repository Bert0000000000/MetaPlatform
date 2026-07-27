package com.metaplatform.llmgw.provider;

import com.metaplatform.llmgw.chat.dto.ChatMessage;
import com.metaplatform.llmgw.chat.dto.ChatRequest;
import com.metaplatform.llmgw.chat.dto.ChatResponse;
import com.metaplatform.llmgw.chat.service.ChatMessageConverter;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Flux;

import java.util.List;

/** Production Spring AI backed provider. Keeps the gateway contract independent of SDK changes. */
@Component
@ConditionalOnMissingBean(LlmProvider.class)
public class SpringAiLlmProvider implements LlmProvider {
    private final ChatModel chatModel;
    private final ChatMessageConverter converter;

    public SpringAiLlmProvider(ChatModel chatModel, ChatMessageConverter converter) {
        this.chatModel = chatModel;
        this.converter = converter;
    }

    @Override
    public ChatResponse chat(ChatRequest request) {
        try {
            var response = chatModel.call(new Prompt(converter.toSpringAiMessages(safeMessages(request))));
            String content = response == null || response.getResult() == null ? "" : response.getResult().getOutput().getText();
            return ChatResponse.success(content, request.model());
        } catch (RuntimeException ex) {
            return ChatResponse.error("LLM_CALL_FAILED", ex.getMessage());
        }
    }

    @Override
    public Flux<String> streamChat(ChatRequest request) {
        try {
            return chatModel.stream(new Prompt(converter.toSpringAiMessages(safeMessages(request))))
                    .map(r -> r == null || r.getResult() == null ? "" : r.getResult().getOutput().getText())
                    .filter(s -> s != null && !s.isEmpty());
        } catch (RuntimeException ex) {
            return Flux.just("[LLM_CALL_FAILED] " + ex.getMessage());
        }
    }

    @Override
    public List<float[]> embed(String model, List<String> texts) {
        throw new UnsupportedOperationException("Embedding is provided by the RAG vector store");
    }

    @Override public boolean isHealthy() { return chatModel != null; }
    @Override public String name() { return "spring-ai"; }

    private List<ChatMessage> safeMessages(ChatRequest request) {
        return request == null || request.messages() == null ? List.of() : request.messages();
    }
}
