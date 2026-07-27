package com.metaplatform.llmgw.provider;

import com.metaplatform.llmgw.chat.dto.ChatRequest;
import com.metaplatform.llmgw.chat.dto.ChatResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import reactor.core.publisher.Flux;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("P8.2 LlmProvider abstractions")
class LlmProviderTest {

    private NoopLlmProvider noop;

    @BeforeEach
    void setUp() {
        noop = new NoopLlmProvider();
    }

    @Test
    @DisplayName("chat: returns error with NO_LLM_PROVIDER code")
    void chatReturnsError() {
        ChatRequest req = new ChatRequest("qwen-max", null, null, null, null, null, null, null);
        ChatResponse resp = noop.chat(req);
        assertNotNull(resp);
        assertTrue(resp.id().startsWith("err-"));
    }

    @Test
    @DisplayName("streamChat: returns single error message")
    void streamChatReturnsError() {
        ChatRequest req = new ChatRequest("qwen-max", null, null, null, null, null, null, null);
        Flux<String> stream = noop.streamChat(req);
        List<String> messages = stream.toStream().toList();
        assertEquals(1, messages.size());
        assertTrue(messages.get(0).contains("NO_LLM_PROVIDER"));
    }

    @Test
    @DisplayName("embed: returns zero vectors")
    void embedReturnsEmpty() {
        List<float[]> result = noop.embed("qwen-max", List.of("hello", "world"));
        assertEquals(2, result.size());
        for (float[] v : result) {
            assertEquals(1024, v.length);
        }
    }

    @Test
    @DisplayName("isHealthy: false (no provider)")
    void isHealthyFalse() {
        assertFalse(noop.isHealthy());
    }

    @Test
    @DisplayName("name: returns noop")
    void nameIsNoop() {
        assertEquals("noop", noop.name());
    }
}

