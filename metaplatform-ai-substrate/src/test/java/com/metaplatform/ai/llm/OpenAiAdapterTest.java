package com.metaplatform.ai.llm;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.ai.llm.adapter.OpenAiAdapter;
import okhttp3.mockwebserver.MockResponse;
import okhttp3.mockwebserver.MockWebServer;
import okhttp3.mockwebserver.RecordedRequest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class OpenAiAdapterTest {

    private MockWebServer mockServer;
    private OpenAiAdapter adapter;
    private final ObjectMapper mapper = new ObjectMapper();

    @BeforeEach
    void setUp() throws IOException {
        mockServer = new MockWebServer();
        mockServer.start();

        String baseUrl = mockServer.url("/v1").toString();
        adapter = new OpenAiAdapter("test-key", baseUrl, mapper);
    }

    @AfterEach
    void tearDown() throws IOException {
        mockServer.shutdown();
    }

    @Test
    void shouldSupportGptModels() {
        assertTrue(adapter.supportsModel("gpt-4o"));
        assertTrue(adapter.supportsModel("gpt-3.5-turbo"));
        assertTrue(adapter.supportsModel("o1-preview"));
        assertFalse(adapter.supportsModel("claude-3-opus"));
    }

    @Test
    void shouldCallOpenAiApi() throws Exception {
        String responseJson = """
            {
                "id": "chatcmpl-123",
                "model": "gpt-4o",
                "choices": [{
                    "index": 0,
                    "message": {"role": "assistant", "content": "Hello!"},
                    "finish_reason": "stop"
                }],
                "usage": {
                    "prompt_tokens": 10,
                    "completion_tokens": 5,
                    "total_tokens": 15
                }
            }
            """;

        mockServer.enqueue(new MockResponse()
                .setResponseCode(200)
                .setBody(responseJson)
                .addHeader("Content-Type", "application/json"));

        LlmRequest request = LlmRequest.simple("gpt-4o", "Hello");
        LlmResponse response = adapter.chat(request);

        assertEquals("chatcmpl-123", response.id());
        assertEquals("gpt-4o", response.model());
        assertEquals("Hello!", response.content());
        assertEquals("stop", response.finishReason());
        assertEquals(15, response.usage().totalTokens());

        // Verify request
        RecordedRequest recorded = mockServer.takeRequest();
        assertEquals("POST", recorded.getMethod());
        assertTrue(recorded.getPath().contains("/chat/completions"));
        String authHeader = recorded.getHeader("Authorization");
        assertEquals("Bearer test-key", authHeader);
    }

    @Test
    void shouldThrowOnApiError() {
        mockServer.enqueue(new MockResponse()
                .setResponseCode(429)
                .setBody("{\"error\": \"rate limit\"}"));

        LlmRequest request = LlmRequest.simple("gpt-4o", "test");
        assertThrows(RuntimeException.class, () -> adapter.chat(request));
    }
}
