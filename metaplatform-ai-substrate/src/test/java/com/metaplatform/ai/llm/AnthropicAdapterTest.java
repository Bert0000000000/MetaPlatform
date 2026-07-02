package com.metaplatform.ai.llm;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.ai.llm.adapter.AnthropicAdapter;
import okhttp3.mockwebserver.MockResponse;
import okhttp3.mockwebserver.MockWebServer;
import okhttp3.mockwebserver.RecordedRequest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class AnthropicAdapterTest {

    private MockWebServer mockServer;
    private AnthropicAdapter adapter;
    private final ObjectMapper mapper = new ObjectMapper();

    @BeforeEach
    void setUp() throws IOException {
        mockServer = new MockWebServer();
        mockServer.start();

        String baseUrl = mockServer.url("/v1").toString();
        adapter = new AnthropicAdapter("test-key", baseUrl, mapper);
    }

    @AfterEach
    void tearDown() throws IOException {
        mockServer.shutdown();
    }

    @Test
    void shouldSupportClaudeModels() {
        assertTrue(adapter.supportsModel("claude-3-opus-20240229"));
        assertTrue(adapter.supportsModel("claude-3-sonnet-20240229"));
        assertTrue(adapter.supportsModel("claude-3-haiku-20240307"));
        assertFalse(adapter.supportsModel("gpt-4o"));
    }

    @Test
    void shouldCallAnthropicApi() throws Exception {
        String responseJson = """
            {
                "id": "msg-123",
                "model": "claude-3-sonnet-20240229",
                "content": [{"type": "text", "text": "Hello from Claude!"}],
                "stop_reason": "end_turn",
                "usage": {
                    "input_tokens": 10,
                    "output_tokens": 8
                }
            }
            """;

        mockServer.enqueue(new MockResponse()
                .setResponseCode(200)
                .setBody(responseJson)
                .addHeader("Content-Type", "application/json"));

        LlmRequest request = LlmRequest.simple("claude-3-sonnet-20240229", "Hello");
        LlmResponse response = adapter.chat(request);

        assertEquals("msg-123", response.id());
        assertEquals("claude-3-sonnet-20240229", response.model());
        assertEquals("Hello from Claude!", response.content());
        assertEquals("end_turn", response.finishReason());
        assertEquals(18, response.usage().totalTokens());

        // Verify request headers
        RecordedRequest recorded = mockServer.takeRequest();
        assertEquals("test-key", recorded.getHeader("x-api-key"));
        assertEquals("2023-06-01", recorded.getHeader("anthropic-version"));
    }

    @Test
    void shouldExtractSystemPrompt() throws Exception {
        String responseJson = """
            {
                "id": "msg-456",
                "model": "claude-3-sonnet-20240229",
                "content": [{"type": "text", "text": "Understood"}],
                "stop_reason": "end_turn",
                "usage": {"input_tokens": 5, "output_tokens": 3}
            }
            """;

        mockServer.enqueue(new MockResponse()
                .setResponseCode(200)
                .setBody(responseJson)
                .addHeader("Content-Type", "application/json"));

        LlmRequest request = new LlmRequest(
                "claude-3-sonnet-20240229",
                List.of(
                        new LlmRequest.ChatMessage("system", "You are helpful."),
                        new LlmRequest.ChatMessage("user", "Hello")
                ),
                0.7, 1024, java.util.Map.of());

        adapter.chat(request);

        RecordedRequest recorded = mockServer.takeRequest();
        String body = recorded.getBody().readUtf8();
        assertTrue(body.contains("\"system\":\"You are helpful.\""));
    }
}
