package com.metaplatform.ai.llm;

/**
 * LLM Gateway interface: unified entry point, responsible for model routing, fallback, and retry.
 */
public interface LlmGateway {

    /**
     * Send a chat request.
     * Automatically routes to the correct adapter based on the model field.
     * Falls back to alternative adapter if the primary one fails.
     */
    LlmResponse chat(LlmRequest request);

    /**
     * Send a chat request with tenant ID (for token billing).
     */
    LlmResponse chat(LlmRequest request, String tenantId);
}
