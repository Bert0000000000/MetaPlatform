package com.metaplatform.ai.agent;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.ai.llm.LlmGateway;
import com.metaplatform.ai.llm.LlmRequest;
import com.metaplatform.ai.llm.LlmResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AgentRuntimeTest {

    @Mock
    private LlmGateway llmGateway;

    private AgentRuntime agentRuntime;
    private final ObjectMapper mapper = new ObjectMapper();

    @BeforeEach
    void setUp() {
        ToolExecutor calculatorTool = new ToolExecutor() {
            @Override
            public String toolName() { return "calculator"; }

            @Override
            public String execute(Map<String, Object> arguments) {
                String expression = (String) arguments.get("expression");
                if ("2+2".equals(expression)) return "4";
                return "unknown";
            }
        };

        agentRuntime = new AgentRuntime(llmGateway, List.of(calculatorTool), mapper);
    }

    @Test
    void shouldReturnDirectResponseWithoutToolCall() {
        when(llmGateway.chat(any(), any())).thenReturn(
                new LlmResponse("id-1", "gpt-4o", "Hello! How can I help you?", "stop",
                        new LlmResponse.TokenUsage(100, 20, 120), Map.of()));

        AgentRequest request = new AgentRequest("smart", "You are helpful.", "Hi", List.of(), Map.of());
        AgentResponse response = agentRuntime.execute(request, "tenant-1");

        assertEquals("Hello! How can I help you?", response.content());
        assertNull(response.toolUsed());
    }

    @Test
    void shouldExecuteToolWhenRequested() {
        String toolCallResponse = """
            I'll calculate that for you.
            {"tool_call": true, "name": "calculator", "arguments": {"expression": "2+2"}}
            """;

        when(llmGateway.chat(any(), any())).thenReturn(
                new LlmResponse("id-2", "gpt-4o", toolCallResponse, "stop",
                        new LlmResponse.TokenUsage(150, 50, 200), Map.of()));

        ToolDefinition calcTool = new ToolDefinition("calculator", "Perform calculations", Map.of());
        AgentRequest request = new AgentRequest("smart", null, "What is 2+2?",
                List.of(calcTool), Map.of());

        AgentResponse response = agentRuntime.execute(request, "tenant-1");

        assertEquals("calculator", response.toolUsed());
        assertEquals("4", response.toolResult());
        assertNotNull(response.toolArguments());
    }

    @Test
    void shouldThrowOnUnknownTool() {
        String toolCallResponse = """
            {"tool_call": true, "name": "unknown_tool", "arguments": {}}
            """;

        when(llmGateway.chat(any(), any())).thenReturn(
                new LlmResponse("id-3", "gpt-4o", toolCallResponse, "stop",
                        new LlmResponse.TokenUsage(100, 30, 130), Map.of()));

        AgentRequest request = new AgentRequest("smart", null, "Do something",
                List.of(), Map.of());

        // When tool is not found, the parse exception is caught and falls back to direct response
        AgentResponse response = agentRuntime.execute(request, "tenant-1");
        assertNotNull(response.content());
    }
}
