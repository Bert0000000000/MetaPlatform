package com.metaplatform.ai.context;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.ai.llm.LlmRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.ListOperations;
import org.springframework.data.redis.core.StringRedisTemplate;

import java.util.List;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class RedisContextStoreTest {

    @Mock
    private StringRedisTemplate redisTemplate;

    @Mock
    private ListOperations<String, String> listOperations;

    private RedisContextStore contextStore;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @BeforeEach
    void setUp() {
        when(redisTemplate.opsForList()).thenReturn(listOperations);
        contextStore = new RedisContextStore(redisTemplate, objectMapper);
    }

    @Test
    void shouldAddMessage() {
        when(listOperations.rightPush(anyString(), anyString())).thenReturn(1L);
        when(listOperations.size(anyString())).thenReturn(1L);

        contextStore.addMessage("session-1", new LlmRequest.ChatMessage("user", "Hello"));

        verify(listOperations).rightPush(eq("context:session-1"), anyString());
        verify(redisTemplate).expire(eq("context:session-1"), eq(24L), eq(TimeUnit.HOURS));
    }

    @Test
    void shouldGetMessages() throws Exception {
        String json = objectMapper.writeValueAsString(new LlmRequest.ChatMessage("user", "Hello"));
        when(listOperations.range("context:session-1", 0, -1)).thenReturn(List.of(json));

        List<LlmRequest.ChatMessage> messages = contextStore.getMessages("session-1");

        assertEquals(1, messages.size());
        assertEquals("user", messages.get(0).role());
        assertEquals("Hello", messages.get(0).content());
    }

    @Test
    void shouldReturnEmptyListWhenNoMessages() {
        when(listOperations.range(anyString(), eq(0L), eq(-1L))).thenReturn(null);

        List<LlmRequest.ChatMessage> messages = contextStore.getMessages("session-1");
        assertTrue(messages.isEmpty());
    }

    @Test
    void shouldGetRecentMessages() throws Exception {
        String json1 = objectMapper.writeValueAsString(new LlmRequest.ChatMessage("user", "Hello"));
        String json2 = objectMapper.writeValueAsString(new LlmRequest.ChatMessage("assistant", "Hi"));
        when(listOperations.size("context:session-1")).thenReturn(2L);
        when(listOperations.range("context:session-1", 1L, 1L)).thenReturn(List.of(json2));

        List<LlmRequest.ChatMessage> messages = contextStore.getRecentMessages("session-1", 1);

        assertEquals(1, messages.size());
        assertEquals("Hi", messages.get(0).content());
    }

    @Test
    void shouldClearContext() {
        contextStore.clear("session-1");
        verify(redisTemplate).delete("context:session-1");
    }

    @Test
    void shouldGetMessageCount() {
        when(listOperations.size("context:session-1")).thenReturn(5L);
        assertEquals(5, contextStore.getMessageCount("session-1"));
    }

    @Test
    void shouldReturnZeroCountWhenEmpty() {
        when(listOperations.size(anyString())).thenReturn(null);
        assertEquals(0, contextStore.getMessageCount("session-1"));
    }
}
