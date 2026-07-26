package com.metaplatform.llmgw.provider;

import com.metaplatform.llmgw.chat.dto.ChatMessage;
import com.metaplatform.llmgw.chat.dto.ChatRequest;
import com.metaplatform.llmgw.chat.dto.ChatResponse;
import com.metaplatform.llmgw.chat.service.ChatMessageConverter;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.model.Generation;
import org.springframework.ai.chat.prompt.Prompt;
import reactor.core.publisher.Flux;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * P8.4 SpringAiLlmProvider - production Spring AI backed provider.
 *
 * <p>The doc (v1.51) marked this deferred due to Spring AI 1.1.x stream API changes.
 * With Spring AI 1.1.2 (project baseline) the API is stable
 * ({@code ChatModel.call(Prompt)} / {@code ChatModel.stream(Prompt)}); we provide
 * direct Mockito-backed coverage for both synchronous and streaming paths.</p>
 */
@DisplayName("P8.4 SpringAiLlmProvider")
class SpringAiLlmProviderTest {

    private ChatModel chatModel;
    private ChatMessageConverter converter;
    private SpringAiLlmProvider provider;

    @BeforeEach
    void setUp() {
        chatModel = Mockito.mock(ChatModel.class);
        converter = Mockito.mock(ChatMessageConverter.class);
        when(converter.toSpringAiMessages(any())).thenReturn(List.of());
        provider = new SpringAiLlmProvider(chatModel, converter);
    }

    private static org.springframework.ai.chat.model.ChatResponse successResponse(String text) {
        AssistantMessage msg = new AssistantMessage(text == null ? "" : text);
        Generation gen = new Generation(msg);
        return new org.springframework.ai.chat.model.ChatResponse(List.of(gen));
    }

    @Test
    @DisplayName("name: returns spring-ai")
    void nameIsSpringAi() {
        assertEquals("spring-ai", provider.name());
    }

    @Test
    @DisplayName("isHealthy: true when ChatModel is wired")
    void isHealthyWhenWired() {
        assertTrue(provider.isHealthy());
    }

    @Test
    @DisplayName("chat: delegates to ChatModel.call and returns text content")
    void chatDelegates() {
        when(chatModel.call(any(Prompt.class))).thenReturn(successResponse("hello world"));
        ChatRequest req = new ChatRequest("qwen-max",
                List.of(new ChatMessage("user", "hi")),
                null, null, null, null, null, null);
        ChatResponse resp = provider.chat(req);
        assertNotNull(resp);
        assertEquals("assistant", resp.choices().get(0).message().role());
        assertEquals("hello world", resp.choices().get(0).message().content());
        assertEquals("qwen-max", resp.model());
        verify(chatModel, times(1)).call(any(Prompt.class));
    }

    @Test
    @DisplayName("chat: empty ChatModel response -> empty content (no NPE)")
    void chatNullSafe() {
        when(chatModel.call(any(Prompt.class))).thenReturn(null);
        ChatRequest req = new ChatRequest("qwen-max", List.of(), null, null, null, null, null, null);
        ChatResponse resp = provider.chat(req);
        assertNotNull(resp);
        assertEquals("", resp.choices().get(0).message().content());
    }

    @Test
    @DisplayName("chat: ChatModel throws -> error ChatResponse with code LLM_CALL_FAILED")
    void chatErrorPath() {
        when(chatModel.call(any(Prompt.class))).thenThrow(new RuntimeException("network down"));
        ChatRequest req = new ChatRequest("qwen-max", List.of(), null, null, null, null, null, null);
        ChatResponse resp = provider.chat(req);
        assertNotNull(resp);
        assertTrue(resp.id().startsWith("err-LLM_CALL_FAILED"));
        assertTrue(resp.finishReason().contains("network down"));
    }

    @Test
    @DisplayName("streamChat: maps Flux<ChatResponse> -> Flux<String> with non-empty chunks")
    void streamChatMapsToStrings() {
        when(chatModel.stream(any(Prompt.class)))
                .thenReturn(Flux.just(successResponse("chunk-1"), successResponse(""), successResponse("chunk-2")));
        ChatRequest req = new ChatRequest("qwen-max", List.of(), null, null, null, null, true, null);
        List<String> out = provider.streamChat(req).collectList().block();
        assertEquals(2, out.size());
        assertTrue(out.contains("chunk-1"));
        assertTrue(out.contains("chunk-2"));
    }

    @Test
    @DisplayName("streamChat: ChatModel throws -> single error message Flux")
    void streamChatErrorPath() {
        when(chatModel.stream(any(Prompt.class))).thenThrow(new RuntimeException("stream failed"));
        ChatRequest req = new ChatRequest("qwen-max", List.of(), null, null, null, null, true, null);
        List<String> errOut = provider.streamChat(req).collectList().block();
        assertEquals(1, errOut.size());
        assertTrue(errOut.get(0).contains("LLM_CALL_FAILED"));
        assertTrue(errOut.get(0).contains("stream failed"));
    }

    @Test
    @DisplayName("embed: UnsupportedOperationException (delegated to RAG vector store)")
    void embedNotSupported() {
        UnsupportedOperationException ex = assertThrows(UnsupportedOperationException.class,
                () -> provider.embed("qwen-max", List.of("hello")));
        assertNotNull(ex.getMessage());
        assertTrue(ex.getMessage().toLowerCase().contains("rag")
                || ex.getMessage().toLowerCase().contains("embedding"));
    }

    @Test
    @DisplayName("chat: null ChatRequest messages -> safe default; ChatModel still called with empty list")
    void chatNullMessagesSafe() {
        ChatRequest req = new ChatRequest("qwen-max", null, null, null, null, null, null, null);
        when(converter.toSpringAiMessages(any())).thenReturn(List.of());
        when(chatModel.call(any(Prompt.class))).thenReturn(successResponse("ok"));
        ChatResponse resp = provider.chat(req);
        assertNotNull(resp);
        assertEquals("ok", resp.choices().get(0).message().content());
        verify(chatModel, never()).call((Prompt) null);
    }
}
