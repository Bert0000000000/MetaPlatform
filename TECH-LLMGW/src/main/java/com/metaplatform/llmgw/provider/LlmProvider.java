package com.metaplatform.llmgw.provider;

import com.metaplatform.llmgw.chat.dto.ChatMessage;
import com.metaplatform.llmgw.chat.dto.ChatRequest;
import com.metaplatform.llmgw.chat.dto.ChatResponse;

import java.util.List;

/**
 * P8.2 LlmProvider abstraction - pluggable backend for chat + embedding.
 *
 * <p>Implementations:
 * <ul>
 *   <li>{@link SpringAiLlmProvider} - default, wraps Spring AI ChatModel</li>
 *   <li>{@link NoopLlmProvider} - safety net, returns empty responses</li>
 *   <li>Custom providers (e.g. direct HTTP) can implement this interface</li>
 * </ul>
 */
public interface LlmProvider {

    ChatResponse chat(ChatRequest request);

    reactor.core.publisher.Flux<String> streamChat(ChatRequest request);

    List<float[]> embed(String model, List<String> texts);

    boolean isHealthy();

    String name();
}
