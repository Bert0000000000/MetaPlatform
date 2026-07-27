package com.metaplatform.agent.runtime;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.agent.middleware.MiddlewareContext;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.tool.ToolCallback;
import org.springframework.ai.tool.definition.ToolDefinition;
import org.springframework.ai.tool.execution.ToolExecutionException;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/** Drives Spring AI automatic tool calling while routing every call through NativeToolExecutionService. */
@Service
public class NativeLlmToolLoopService {
    private static final TypeReference<Map<String, Object>> ARGS = new TypeReference<>() {};
    private static final List<String> READ_TOOLS = List.of(
            "ontology.search_objects", "ontology.query_metric",
            "ontology.get_object_graph", "ontology.fetch_evidence");

    private final ChatClient.Builder chatClientBuilder;
    private final ObjectMapper objectMapper;
    private final NativeToolExecutionService toolExecutionService;

    public NativeLlmToolLoopService(ChatClient.Builder chatClientBuilder, ObjectMapper objectMapper,
                                    NativeToolExecutionService toolExecutionService) {
        this.chatClientBuilder = chatClientBuilder;
        this.objectMapper = objectMapper;
        this.toolExecutionService = toolExecutionService;
    }

    public String execute(MiddlewareContext context) {
        if (context == null || context.getOntologyContext() == null)
            throw new IllegalArgumentException("signed ontology context is required");
        List<ToolCallback> callbacks = new ArrayList<>();
        for (String tool : READ_TOOLS) {
            if (context.getOntologyContext().allowsTool(tool)) callbacks.add(callback(context, tool));
        }
        if (callbacks.isEmpty()) throw new IllegalStateException("no allowed ontology tools");
        return chatClientBuilder.build().prompt().user(context.getUserMessage())
                .toolCallbacks(callbacks).call().content();
    }

    private ToolCallback callback(MiddlewareContext context, String toolName) {
        ToolDefinition definition = ToolDefinition.builder().name(toolName)
                .description("Read-only Ontology tool: " + toolName)
                .inputSchema("{\"type\":\"object\"}").build();
        return new ToolCallback() {
            @Override public ToolDefinition getToolDefinition() { return definition; }
            @Override public String call(String input) {
                try {
                    Map<String, Object> args = objectMapper.readValue(input == null ? "{}" : input, ARGS);
                    return objectMapper.writeValueAsString(toolExecutionService.execute(context, toolName, args));
                } catch (Exception ex) {
                    throw new ToolExecutionException(definition, ex);
                }
            }
        };
    }
}
