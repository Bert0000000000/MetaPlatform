package com.metaplatform.mcp.builtin;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;

/**
 * Built-in MCP tool executor that proxies to TECH-ACTION (Action Engine).
 * Registered tool codes: {@code action_execute}, {@code action_list}.
 */
@Component
public class ActionToolExecutor extends AbstractBuiltinToolExecutor {

    public ActionToolExecutor(WebClient.Builder builder,
                              @Value("${mcp.builtin.action-base-url:http://localhost:8104}") String baseUrl) {
        super(builder, baseUrl, "/api/v1/action/", "action_");
    }
}
