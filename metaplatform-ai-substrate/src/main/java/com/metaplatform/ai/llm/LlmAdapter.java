package com.metaplatform.ai.llm;

/**
 * LLM adapter interface: each LLM vendor implements one adapter.
 */
public interface LlmAdapter {

    /** Adapter name */
    String name();

    /** Whether this adapter supports the given model */
    boolean supportsModel(String model);

    /** Call the LLM */
    LlmResponse chat(LlmRequest request);
}
