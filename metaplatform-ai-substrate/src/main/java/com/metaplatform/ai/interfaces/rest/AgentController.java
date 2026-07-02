package com.metaplatform.ai.interfaces.rest;

import com.metaplatform.ai.agent.*;
import com.metaplatform.ai.interfaces.rest.dto.AgentApiRequest;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/agent")
public class AgentController {

    private final AgentRuntime agentRuntime;

    public AgentController(AgentRuntime agentRuntime) {
        this.agentRuntime = agentRuntime;
    }

    @PostMapping("/execute")
    public ResponseEntity<Map<String, Object>> execute(
            @Valid @RequestBody AgentApiRequest request,
            @RequestParam(defaultValue = "default") String tenantId) {

        List<ToolDefinition> tools = request.tools() != null ?
                request.tools().stream()
                        .map(t -> new ToolDefinition(t.name(), t.description(), t.parameters()))
                        .toList() :
                List.of();

        AgentRequest agentRequest = new AgentRequest(
                request.model(),
                request.systemPrompt(),
                request.userMessage(),
                tools,
                Map.of()
        );

        AgentResponse response = agentRuntime.execute(agentRequest, tenantId);

        Map<String, Object> result = new java.util.LinkedHashMap<>();
        result.put("content", response.content());
        result.put("toolUsed", response.toolUsed());
        result.put("toolArguments", response.toolArguments());
        result.put("toolResult", response.toolResult());
        if (response.usage() != null) {
            result.put("usage", Map.of(
                    "promptTokens", response.usage().promptTokens(),
                    "completionTokens", response.usage().completionTokens(),
                    "totalTokens", response.usage().totalTokens()
            ));
        }

        return ResponseEntity.ok(result);
    }
}
