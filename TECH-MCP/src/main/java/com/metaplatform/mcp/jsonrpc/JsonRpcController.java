package com.metaplatform.mcp.jsonrpc;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.mcp.tool.dto.ToolExecutionResponse;
import com.metaplatform.mcp.tool.entity.McpToolEntity;
import com.metaplatform.mcp.tool.service.McpToolService;
import com.metaplatform.mcp.tool.service.ToolExecutionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/v1/mcp/jsonrpc")
@RequiredArgsConstructor
public class JsonRpcController {

    private static final String PROTOCOL_VERSION = "2024-11-05";

    private static final int CODE_METHOD_NOT_FOUND = -32601;
    private static final int CODE_INVALID_PARAMS = -32602;
    private static final int CODE_INTERNAL_ERROR = -32603;

    private final McpToolService mcpToolService;
    private final ToolExecutionService toolExecutionService;
    private final ObjectMapper objectMapper;

    @PostMapping
    public JsonRpcResponse handle(@RequestBody JsonRpcRequest request) {
        if (request.getMethod() == null || request.getMethod().isBlank()) {
            return JsonRpcResponse.error(request.getId(), CODE_METHOD_NOT_FOUND, "Method not found");
        }
        try {
            return switch (request.getMethod()) {
                case "initialize" -> initialize(request);
                case "tools/list" -> listTools(request);
                case "tools/call" -> callTool(request);
                case "resources/list" -> listResources(request);
                default -> JsonRpcResponse.error(request.getId(), CODE_METHOD_NOT_FOUND,
                        "Method not found: " + request.getMethod());
            };
        } catch (Exception e) {
            log.error("JSON-RPC handling failed for method={}, id={}", request.getMethod(), request.getId(), e);
            return JsonRpcResponse.error(request.getId(), CODE_INTERNAL_ERROR, e.getMessage());
        }
    }

    private JsonRpcResponse initialize(JsonRpcRequest request) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("protocolVersion", PROTOCOL_VERSION);
        result.put("capabilities", Map.of(
                "tools", Map.of(),
                "resources", Map.of()
        ));
        result.put("serverInfo", Map.of(
                "name", "tech-mcp",
                "version", "0.0.1"
        ));
        return JsonRpcResponse.success(request.getId(), result);
    }

    private JsonRpcResponse listTools(JsonRpcRequest request) {
        List<McpToolEntity> tools = mcpToolService.listEnabled();
        List<Map<String, Object>> toolList = tools.stream()
                .map(this::toToolDescriptor)
                .toList();
        return JsonRpcResponse.success(request.getId(), Map.of("tools", toolList));
    }

    private JsonRpcResponse callTool(JsonRpcRequest request) {
        Map<String, Object> params = request.getParams();
        if (params == null || params.get("name") == null) {
            return JsonRpcResponse.error(request.getId(), CODE_INVALID_PARAMS,
                    "Missing required param: name");
        }
        String name = String.valueOf(params.get("name"));
        McpToolEntity tool = mcpToolService.findByCode(name);
        Object arguments = params.get("arguments");
        String input = serializeArguments(arguments);
        ToolExecutionResponse exec = toolExecutionService.executeTool(tool.getId(), input);

        boolean isError = !"SUCCESS".equals(exec.getStatus());
        String text = isError
                ? (exec.getErrorMessage() == null ? "execution failed" : exec.getErrorMessage())
                : (exec.getOutput() == null ? "" : exec.getOutput());
        Map<String, Object> contentItem = Map.of("type", "text", "text", text);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("content", List.of(contentItem));
        result.put("isError", isError);
        return JsonRpcResponse.success(request.getId(), result);
    }

    private JsonRpcResponse listResources(JsonRpcRequest request) {
        return JsonRpcResponse.success(request.getId(), Map.of("resources", List.of()));
    }

    private Map<String, Object> toToolDescriptor(McpToolEntity tool) {
        Map<String, Object> descriptor = new LinkedHashMap<>();
        descriptor.put("name", tool.getCode());
        descriptor.put("title", tool.getName());
        descriptor.put("description", tool.getDescription() == null ? "" : tool.getDescription());
        descriptor.put("inputSchema", parseJson(tool.getInputSchema()));
        return descriptor;
    }

    private Object parseJson(String value) {
        if (value == null || value.isBlank()) {
            return Map.of();
        }
        try {
            JsonNode node = objectMapper.readTree(value);
            return objectMapper.treeToValue(node, Object.class);
        } catch (Exception e) {
            return Map.of();
        }
    }

    private String serializeArguments(Object arguments) {
        if (arguments == null) {
            return "{}";
        }
        try {
            return objectMapper.writeValueAsString(arguments);
        } catch (Exception e) {
            return "{}";
        }
    }
}
