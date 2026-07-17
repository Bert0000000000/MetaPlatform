package com.metaplatform.mcp.builtin;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;

/**
 * Built-in MCP tool executor that proxies to TECH-ONT (Ontology Engine).
 * Registered tool codes: {@code ont_query_concepts}, {@code ont_query_entities},
 * {@code ont_query_graph}.
 */
@Component
public class OntToolExecutor extends AbstractBuiltinToolExecutor {

    public OntToolExecutor(WebClient.Builder builder,
                           @Value("${mcp.builtin.ont-base-url:http://localhost:8201}") String baseUrl) {
        super(builder, baseUrl, "/api/v1/ont/", "ont_query_");
    }
}
