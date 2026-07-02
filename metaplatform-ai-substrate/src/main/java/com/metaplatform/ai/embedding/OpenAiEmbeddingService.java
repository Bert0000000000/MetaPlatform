package com.metaplatform.ai.embedding;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import okhttp3.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;

@Service
public class OpenAiEmbeddingService implements EmbeddingService {

    private static final Logger log = LoggerFactory.getLogger(OpenAiEmbeddingService.class);
    private static final String CACHE_PREFIX = "embedding:";
    private static final long CACHE_TTL_HOURS = 24;

    private final String apiKey;
    private final String baseUrl;
    private final String defaultModel;
    private final OkHttpClient httpClient;
    private final ObjectMapper mapper;
    private final StringRedisTemplate redisTemplate;

    public OpenAiEmbeddingService(
            @Value("${ai.openai.api-key}") String apiKey,
            @Value("${ai.openai.base-url:https://api.openai.com/v1}") String baseUrl,
            @Value("${ai.openai.embedding-model:text-embedding-ada-002}") String defaultModel,
            ObjectMapper mapper,
            StringRedisTemplate redisTemplate) {
        this.apiKey = apiKey;
        this.baseUrl = baseUrl;
        this.defaultModel = defaultModel;
        this.mapper = mapper;
        this.redisTemplate = redisTemplate;
        this.httpClient = new OkHttpClient.Builder()
                .connectTimeout(30, TimeUnit.SECONDS)
                .readTimeout(60, TimeUnit.SECONDS)
                .build();
    }

    @Override
    public EmbeddingResponse embed(EmbeddingRequest request) {
        String model = request.model() != null ? request.model() : defaultModel;

        try {
            ObjectNode body = mapper.createObjectNode();
            body.put("model", model);
            ArrayNode input = body.putArray("input");
            request.texts().forEach(input::add);

            String jsonBody = mapper.writeValueAsString(body);

            Request httpRequest = new Request.Builder()
                    .url(baseUrl + "/embeddings")
                    .addHeader("Authorization", "Bearer " + apiKey)
                    .addHeader("Content-Type", "application/json")
                    .post(RequestBody.create(jsonBody, MediaType.parse("application/json")))
                    .build();

            try (Response response = httpClient.newCall(httpRequest).execute()) {
                String responseBody = response.body() != null ? response.body().string() : "";

                if (!response.isSuccessful()) {
                    log.error("OpenAI Embedding API error: status={}, body={}", response.code(), responseBody);
                    throw new RuntimeException("OpenAI Embedding API error: " + response.code());
                }

                JsonNode root = mapper.readTree(responseBody);
                JsonNode data = root.path("data");

                List<EmbeddingResponse.Embedding> embeddings = new ArrayList<>();
                for (JsonNode item : data) {
                    int index = item.path("index").asInt();
                    List<Float> vector = new ArrayList<>();
                    for (JsonNode val : item.path("embedding")) {
                        vector.add(val.floatValue());
                    }
                    embeddings.add(new EmbeddingResponse.Embedding(index, vector));
                }

                return new EmbeddingResponse(root.path("model").asText(model), embeddings);
            }
        } catch (IOException e) {
            log.error("Failed to call OpenAI Embedding API: {}", e.getMessage(), e);
            throw new RuntimeException("Embedding API call failed", e);
        }
    }

    @Override
    public EmbeddingResponse embedWithCache(EmbeddingRequest request) {
        String model = request.model() != null ? request.model() : defaultModel;

        // Check cache
        List<String> uncachedTexts = new ArrayList<>();
        List<Integer> uncachedIndices = new ArrayList<>();
        List<EmbeddingResponse.Embedding> cachedResults = new ArrayList<>();

        for (int i = 0; i < request.texts().size(); i++) {
            String text = request.texts().get(i);
            String cacheKey = buildCacheKey(model, text);
            String cached = redisTemplate.opsForValue().get(cacheKey);

            if (cached != null) {
                try {
                    EmbeddingResponse.Embedding embedding = mapper.readValue(cached, EmbeddingResponse.Embedding.class);
                    cachedResults.add(new EmbeddingResponse.Embedding(i, embedding.vector()));
                } catch (Exception e) {
                    uncachedTexts.add(text);
                    uncachedIndices.add(i);
                }
            } else {
                uncachedTexts.add(text);
                uncachedIndices.add(i);
            }
        }

        // Call API for uncached texts
        if (!uncachedTexts.isEmpty()) {
            EmbeddingResponse apiResponse = embed(new EmbeddingRequest(model, uncachedTexts));

            // Write to cache
            for (EmbeddingResponse.Embedding emb : apiResponse.embeddings()) {
                String cacheKey = buildCacheKey(model, uncachedTexts.get(emb.index()));
                try {
                    String json = mapper.writeValueAsString(emb);
                    redisTemplate.opsForValue().set(cacheKey, json, CACHE_TTL_HOURS, TimeUnit.HOURS);
                } catch (Exception e) {
                    log.warn("Failed to cache embedding: {}", e.getMessage());
                }
                // Correct index to original position
                cachedResults.add(new EmbeddingResponse.Embedding(uncachedIndices.get(emb.index()), emb.vector()));
            }
        }

        // Sort by original order
        cachedResults.sort((a, b) -> Integer.compare(a.index(), b.index()));

        return new EmbeddingResponse(model, cachedResults);
    }

    private String buildCacheKey(String model, String text) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] hash = md.digest((model + ":" + text).getBytes());
            StringBuilder sb = new StringBuilder();
            for (byte b : hash) {
                sb.append(String.format("%02x", b));
            }
            return CACHE_PREFIX + sb.toString();
        } catch (Exception e) {
            return CACHE_PREFIX + text.hashCode();
        }
    }
}
