package com.metaplatform.agent.tools;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.modelcontextprotocol.client.McpSyncClient;
import io.modelcontextprotocol.spec.McpSchema;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.tool.ToolCallback;
import org.springframework.ai.tool.definition.ToolDefinition;
import org.springframework.ai.tool.execution.ToolExecutionException;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.context.annotation.Bean;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
public class McpToolCallbackAdapter {

    private static final TypeReference<Map<String, Object>> ARGUMENTS_TYPE = new TypeReference<>() { };

    private final ObjectMapper objectMapper;

    @Bean
    public List<ToolCallback> mcpToolCallbacks(ObjectProvider<List<McpSyncClient>> clientsProvider) {
        List<ToolCallback> callbacks = new ArrayList<>();
        for (McpSyncClient client : clientsProvider.getIfAvailable(List::of)) {
            try {
                if (!client.isInitialized()) {
                    client.initialize();
                }
                client.listTools().tools().stream()
                        .map(tool -> adapt(client, tool))
                        .forEach(callbacks::add);
            } catch (Exception exception) {
                log.warn("MCP Server 不可用，跳过工具加载", exception);
            }
        }
        return List.copyOf(callbacks);
    }

    private ToolCallback adapt(McpSyncClient client, McpSchema.Tool tool) {
        String inputSchema = toJson(tool.inputSchema());
        ToolDefinition definition = ToolDefinition.builder()
                .name(tool.name())
                .description(tool.description() == null ? "" : tool.description())
                .inputSchema(inputSchema)
                .build();

        return new ToolCallback() {
            @Override
            public ToolDefinition getToolDefinition() {
                return definition;
            }

            @Override
            public String call(String input) {
                try {
                    Map<String, Object> arguments = objectMapper.readValue(input, ARGUMENTS_TYPE);
                    return objectMapper.writeValueAsString(client.callTool(
                            new McpSchema.CallToolRequest(tool.name(), arguments)).content());
                } catch (Exception exception) {
                    throw new ToolExecutionException(definition, exception);
                }
            }
        };
    }

    private String toJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception exception) {
            throw new IllegalStateException("无法序列化 MCP 工具 Schema", exception);
        }
    }
}
