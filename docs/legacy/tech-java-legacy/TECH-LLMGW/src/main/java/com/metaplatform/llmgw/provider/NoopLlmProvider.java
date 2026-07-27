package com.metaplatform.llmgw.provider;

import com.metaplatform.llmgw.chat.dto.ChatRequest;
import com.metaplatform.llmgw.chat.dto.ChatResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Flux;

import java.util.List;

/**
 * P8.2 NoopLlmProvider - safety net when no ChatModel is available.
 *
 * <p>Activated by {@code @ConditionalOnMissingBean(LlmProvider.class)} when no real
 * provider is configured. Returns empty responses with a clear error so callers
 * can detect the misconfiguration rather than crash silently.</p>
 */
@Slf4j
@Component
public class NoopLlmProvider implements LlmProvider {

    @Override
    public ChatResponse chat(ChatRequest request) {
        log.warn("[NoopLlmProvider] no LlmProvider configured; returning error");
        return ChatResponse.error("NO_LLM_PROVIDER", "No LlmProvider is configured");
    }

    @Override
    public Flux<String> streamChat(ChatRequest request) {
        return Flux.just("[NO_LLM_PROVIDER] No LlmProvider is configured");
    }

    @Override
    public List<float[]> embed(String model, List<String> texts) {
        return texts.stream().map(t -> new float[1024]).toList();
    }

    @Override
    public boolean isHealthy() { return false; }

    @Override
    public String name() { return "noop"; }
}
