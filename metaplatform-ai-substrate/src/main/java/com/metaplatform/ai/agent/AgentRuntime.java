package com.metaplatform.ai.agent;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.ai.llm.LlmGateway;
import com.metaplatform.ai.llm.LlmRequest;
import com.metaplatform.ai.llm.LlmResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.*;

/**
 * Agent runtime: single-step tool calling.
 *
 * Flow:
 * 1. Build system prompt with tool definitions
 * 2. Call LLM
 * 3. If LLM returns tool_calls, execute the tool and return the result
 * 4. If LLM returns plain text, return directly
 */
@Service
public class AgentRuntime {

    private static final Logger log = LoggerFactory.getLogger(AgentRuntime.class);

    private final LlmGateway llmGateway;
    private final List<ToolExecutor> toolExecutors;
    private final ObjectMapper mapper;

    public AgentRuntime(LlmGateway llmGateway, List<ToolExecutor> toolExecutors, ObjectMapper mapper) {
        this.llmGateway = llmGateway;
        this.toolExecutors = toolExecutors;
        this.mapper = mapper;
    }

    /**
     * Execute an Agent request (single-step tool calling)
     */
    public AgentResponse execute(AgentRequest request, String tenantId) {
        // 1. Build enhanced system prompt with tool descriptions
        String enhancedSystemPrompt = buildEnhancedSystemPrompt(request);

        // 2. Build message list
        List<LlmRequest.ChatMessage> messages = new ArrayList<>();
        messages.add(new LlmRequest.ChatMessage("system", enhancedSystemPrompt));
        messages.add(new LlmRequest.ChatMessage("user", request.userMessage()));

        // 3. Call LLM
        LlmRequest llmRequest = new LlmRequest(
                request.model() != null ? request.model() : "smart",
                messages,
                0.7,
                2048,
                Map.of()
        );

        LlmResponse llmResponse = llmGateway.chat(llmRequest, tenantId);

        // 4. Check if a tool call is needed
        String content = llmResponse.content();

        // v0.1 simplified: check if content contains a tool call instruction (JSON format)
        if (content.contains("\"tool_call\"") && content.contains("\"name\"")) {
            try {
                return handleToolCall(content, request, tenantId, llmResponse);
            } catch (Exception e) {
                log.warn("Failed to parse tool call: {}", e.getMessage());
                // Fall back to returning the LLM response directly
            }
        }

        // 5. Return plain text response
        return new AgentResponse(
                content,
                null,
                null,
                null,
                new AgentResponse.TokenUsage(
                        llmResponse.usage().promptTokens(),
                        llmResponse.usage().completionTokens(),
                        llmResponse.usage().totalTokens()
                )
        );
    }

    private AgentResponse handleToolCall(String content, AgentRequest request,
                                          String tenantId, LlmResponse llmResponse) throws Exception {
        // Parse tool call
        JsonNode root = mapper.readTree(extractJson(content));
        String toolName = root.path("name").asText();
        JsonNode argsNode = root.path("arguments");
        Map<String, Object> arguments = mapper.convertValue(argsNode, Map.class);

        log.info("Agent requesting tool call: tool={}, args={}", toolName, arguments);

        // Find and execute the tool
        ToolExecutor executor = toolExecutors.stream()
                .filter(e -> e.toolName().equals(toolName))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Tool not found: " + toolName));

        String toolResult = executor.execute(arguments);

        log.info("Tool execution result: tool={}, resultLength={}", toolName, toolResult.length());

        return new AgentResponse(
                toolResult,
                toolName,
                arguments,
                toolResult,
                new AgentResponse.TokenUsage(
                        llmResponse.usage().promptTokens(),
                        llmResponse.usage().completionTokens(),
                        llmResponse.usage().totalTokens()
                )
        );
    }

    private String buildEnhancedSystemPrompt(AgentRequest request) {
        StringBuilder sb = new StringBuilder();

        if (request.systemPrompt() != null && !request.systemPrompt().isBlank()) {
            sb.append(request.systemPrompt()).append("\n\n");
        }

        if (request.tools() != null && !request.tools().isEmpty()) {
            sb.append("## Available Tools\n\n");
            sb.append("You have access to the following tools. To use a tool, respond with a JSON object:\n");
            sb.append("{\"tool_call\": true, \"name\": \"<tool_name>\", \"arguments\": {<args>}}\n\n");

            for (ToolDefinition tool : request.tools()) {
                sb.append("### ").append(tool.name()).append("\n");
                sb.append("**Description:** ").append(tool.description()).append("\n");
                if (tool.parameters() != null && !tool.parameters().isEmpty()) {
                    sb.append("**Parameters:** ").append(mapper.valueToTree(tool.parameters())).append("\n");
                }
                sb.append("\n");
            }
        }

        return sb.toString();
    }

    private String extractJson(String content) {
        // Extract JSON portion (simple implementation)
        int start = content.indexOf('{');
        int end = content.lastIndexOf('}');
        if (start >= 0 && end > start) {
            return content.substring(start, end + 1);
        }
        return content;
    }
}
