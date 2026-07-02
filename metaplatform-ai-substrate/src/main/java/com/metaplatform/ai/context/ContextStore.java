package com.metaplatform.ai.context;

import com.metaplatform.ai.llm.LlmRequest;

import java.util.List;

/**
 * Context store: manages AI conversation context windows.
 * Uses Redis List for sliding window implementation with automatic eviction of old messages.
 */
public interface ContextStore {

    /**
     * Add a message to the context
     */
    void addMessage(String sessionId, LlmRequest.ChatMessage message);

    /**
     * Get all messages in the context (in chronological order)
     */
    List<LlmRequest.ChatMessage> getMessages(String sessionId);

    /**
     * Get the most recent N messages
     */
    List<LlmRequest.ChatMessage> getRecentMessages(String sessionId, int limit);

    /**
     * Clear the context
     */
    void clear(String sessionId);

    /**
     * Get the message count in the context
     */
    long getMessageCount(String sessionId);
}
