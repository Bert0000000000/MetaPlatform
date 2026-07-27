package com.metaplatform.mcp.builtin;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;

/**
 * Built-in MCP tool executor that proxies to TECH-RAG (RAG Engine).
 * Registered tool codes: {@code rag_search}, {@code rag_list_knowledge_bases}.
 */
@Component
public class RagToolExecutor extends AbstractBuiltinToolExecutor {

    public RagToolExecutor(WebClient.Builder builder,
                           @Value("${mcp.builtin.rag-base-url:http://localhost:8901}") String baseUrl) {
        super(builder, baseUrl, "/api/v1/rag/", "rag_");
    }
}
