package com.metaplatform.ai.context;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.ai.llm.LlmRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;

/**
 * Redis-based context store.
 * Uses Redis List for message storage with sliding window and TTL auto-expiry.
 */
@Service
public class RedisContextStore implements ContextStore {

    private static final Logger log = LoggerFactory.getLogger(RedisContextStore.class);

    private static final String KEY_PREFIX = "context:";
    private static final int MAX_MESSAGES = 100;
    private static final long TTL_HOURS = 24;

    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;

    public RedisContextStore(StringRedisTemplate redisTemplate, ObjectMapper objectMapper) {
        this.redisTemplate = redisTemplate;
        this.objectMapper = objectMapper;
    }

    @Override
    public void addMessage(String sessionId, LlmRequest.ChatMessage message) {
        String key = buildKey(sessionId);

        try {
            String json = objectMapper.writeValueAsString(message);
            redisTemplate.opsForList().rightPush(key, json);

            // Maintain sliding window size
            Long size = redisTemplate.opsForList().size(key);
            if (size != null && size > MAX_MESSAGES) {
                redisTemplate.opsForList().trim(key, size - MAX_MESSAGES, size - 1);
            }

            // Refresh TTL
            redisTemplate.expire(key, TTL_HOURS, TimeUnit.HOURS);

        } catch (JsonProcessingException e) {
            log.error("Failed to serialize message: {}", e.getMessage());
        }
    }

    @Override
    public List<LlmRequest.ChatMessage> getMessages(String sessionId) {
        String key = buildKey(sessionId);
        List<String> jsonList = redisTemplate.opsForList().range(key, 0, -1);

        if (jsonList == null) return List.of();

        List<LlmRequest.ChatMessage> messages = new ArrayList<>();
        for (String json : jsonList) {
            try {
                messages.add(objectMapper.readValue(json, LlmRequest.ChatMessage.class));
            } catch (JsonProcessingException e) {
                log.warn("Failed to deserialize message: {}", e.getMessage());
            }
        }
        return messages;
    }

    @Override
    public List<LlmRequest.ChatMessage> getRecentMessages(String sessionId, int limit) {
        String key = buildKey(sessionId);
        Long size = redisTemplate.opsForList().size(key);
        if (size == null || size == 0) return List.of();

        long start = Math.max(0, size - limit);
        List<String> jsonList = redisTemplate.opsForList().range(key, start, size - 1);

        if (jsonList == null) return List.of();

        List<LlmRequest.ChatMessage> messages = new ArrayList<>();
        for (String json : jsonList) {
            try {
                messages.add(objectMapper.readValue(json, LlmRequest.ChatMessage.class));
            } catch (JsonProcessingException e) {
                log.warn("Failed to deserialize message: {}", e.getMessage());
            }
        }
        return messages;
    }

    @Override
    public void clear(String sessionId) {
        String key = buildKey(sessionId);
        redisTemplate.delete(key);
    }

    @Override
    public long getMessageCount(String sessionId) {
        String key = buildKey(sessionId);
        Long size = redisTemplate.opsForList().size(key);
        return size != null ? size : 0;
    }

    private String buildKey(String sessionId) {
        return KEY_PREFIX + sessionId;
    }
}
