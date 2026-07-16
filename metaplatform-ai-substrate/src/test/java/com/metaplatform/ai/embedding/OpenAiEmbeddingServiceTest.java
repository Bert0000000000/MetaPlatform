package com.metaplatform.ai.embedding;

import com.fasterxml.jackson.databind.ObjectMapper;
import okhttp3.mockwebserver.MockResponse;
import okhttp3.mockwebserver.MockWebServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import java.io.IOException;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class OpenAiEmbeddingServiceTest {

    private MockWebServer mockServer;
    private OpenAiEmbeddingService service;
    private final ObjectMapper mapper = new ObjectMapper();

    @BeforeEach
    void setUp() throws IOException {
        mockServer = new MockWebServer();
        mockServer.start();

        StringRedisTemplate redisTemplate = mock(StringRedisTemplate.class);
        ValueOperations<String, String> valueOps = mock(ValueOperations.class);
        when(redisTemplate.opsForValue()).thenReturn(valueOps);

        String baseUrl = mockServer.url("/v1").toString();
        service = new OpenAiEmbeddingService("test-key", baseUrl,
                "text-embedding-ada-002", mapper, redisTemplate);
    }

    @AfterEach
    void tearDown() throws IOException {
        mockServer.shutdown();
    }

    @Test
    void shouldGenerateEmbeddings() throws Exception {
        String responseJson = """
            {
                "object": "list",
                "data": [{
                    "object": "embedding",
                    "index": 0,
                    "embedding": [0.1, 0.2, 0.3, 0.4, 0.5]
                }],
                "model": "text-embedding-ada-002",
                "usage": {"prompt_tokens": 5, "total_tokens": 5}
            }
            """;

        mockServer.enqueue(new MockResponse()
                .setResponseCode(200)
                .setBody(responseJson)
                .addHeader("Content-Type", "application/json"));

        EmbeddingRequest request = new EmbeddingRequest("text-embedding-ada-002", List.of("Hello world"));
        EmbeddingResponse response = service.embed(request);

        assertEquals("text-embedding-ada-002", response.model());
        assertEquals(1, response.embeddings().size());
        assertEquals(5, response.embeddings().get(0).vector().size());
        assertEquals(0.1f, response.embeddings().get(0).vector().get(0), 0.001f);
    }

    @Test
    void shouldHandleBatchEmbeddings() throws Exception {
        String responseJson = """
            {
                "object": "list",
                "data": [
                    {"object": "embedding", "index": 0, "embedding": [0.1, 0.2]},
                    {"object": "embedding", "index": 1, "embedding": [0.3, 0.4]}
                ],
                "model": "text-embedding-ada-002",
                "usage": {"prompt_tokens": 10, "total_tokens": 10}
            }
            """;

        mockServer.enqueue(new MockResponse()
                .setResponseCode(200)
                .setBody(responseJson)
                .addHeader("Content-Type", "application/json"));

        EmbeddingRequest request = new EmbeddingRequest(null, List.of("Text 1", "Text 2"));
        EmbeddingResponse response = service.embed(request);

        assertEquals(2, response.embeddings().size());
    }
}
