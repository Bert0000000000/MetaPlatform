package com.metaplatform.mcp.jsonrpc;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.mcp.audit.aspect.McpAudit;
import com.metaplatform.mcp.common.ErrorCode;
import com.metaplatform.mcp.common.TenantContext;
import com.metaplatform.mcp.exception.McpException;
import com.metaplatform.mcp.jsonrpc.dto.CallToolResult;
import com.metaplatform.mcp.jsonrpc.dto.CompletionResult;
import com.metaplatform.mcp.jsonrpc.dto.Content;
import com.metaplatform.mcp.jsonrpc.dto.EmptyResult;
import com.metaplatform.mcp.jsonrpc.dto.GetPromptResult;
import com.metaplatform.mcp.jsonrpc.dto.InitializeResult;
import com.metaplatform.mcp.jsonrpc.dto.ListPromptsResult;
import com.metaplatform.mcp.jsonrpc.dto.ListResourceTemplatesResult;
import com.metaplatform.mcp.jsonrpc.dto.ListResourcesResult;
import com.metaplatform.mcp.jsonrpc.dto.ListToolsResult;
import com.metaplatform.mcp.jsonrpc.dto.PromptArgument;
import com.metaplatform.mcp.jsonrpc.dto.PromptMessage;
import com.metaplatform.mcp.jsonrpc.dto.PromptSchema;
import com.metaplatform.mcp.jsonrpc.dto.ReadResourceResult;
import com.metaplatform.mcp.jsonrpc.dto.ResourceContent;
import com.metaplatform.mcp.jsonrpc.dto.ResourceSchema;
import com.metaplatform.mcp.jsonrpc.dto.ToolSchema;
import com.metaplatform.mcp.prompt.entity.McpPromptTemplateEntity;
import com.metaplatform.mcp.prompt.repository.McpPromptTemplateRepository;
import com.metaplatform.mcp.prompt.service.PromptTemplateService;
import com.metaplatform.mcp.resource.entity.McpResourceEntity;
import com.metaplatform.mcp.resource.repository.McpResourceRepository;
import com.metaplatform.mcp.tool.dto.ToolExecutionResponse;
import com.metaplatform.mcp.tool.entity.McpToolEntity;
import com.metaplatform.mcp.tool.repository.McpToolRepository;
import com.metaplatform.mcp.tool.service.McpToolService;
import com.metaplatform.mcp.tool.service.ToolExecutionService;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Implementation of the MCP 2025-03-26 protocol surface over JSON-RPC 2.0. Each supported MCP
 * method is registered as a {@link MethodHandler} in {@link #methodRegistry}; {@link #handle}
 * dispatches by name. The registry is built up in {@link #registerHandlers()} after dependency
 * injection so we can reference instance methods.
 *
 * <p><b>SDK integration:</b> this class is designed to be backed by the Spring AI MCP SDK
 * (spring-ai-starter-mcp-server-webmvc) once a stable typed transport API is available. Until
 * then we serve the wire contract directly, but all response DTOs mirror the spec 1:1 so a
 * later swap to {@code McpServerTransport}/{@code McpToolDefinition} is mechanical.
 * <i>SDK 适配层待 Spring AI 1.2.0 升级</i>.</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class McpProtocolService {

    public static final String PROTOCOL_VERSION = "2025-03-26";
    public static final String SERVER_NAME = "mate-platform-mcp";
    public static final String SERVER_VERSION = "1.0.0";

    public static final int CODE_PARSE_ERROR = -32700;
    public static final int CODE_INVALID_REQUEST = -32600;
    public static final int CODE_METHOD_NOT_FOUND = -32601;
    public static final int CODE_INVALID_PARAMS = -32602;
    public static final int CODE_INTERNAL_ERROR = -32603;
    public static final int CODE_SERVER_ERROR = -32000;

    private static final Set<String> SUPPORTED_LOG_LEVELS =
            Set.of("debug", "info", "notice", "warning", "error", "critical", "alert", "emergency");

    private static final int DEFAULT_PAGE_SIZE = 50;
    private static final int MAX_PAGE_SIZE = 200;

    private static final Pattern VAR_PATTERN = Pattern.compile("\\{\\{\\s*([\\w.]+)\\s*\\}\\}");

    private final McpToolService mcpToolService;
    private final ToolExecutionService toolExecutionService;
    private final PromptTemplateService promptTemplateService;
    private final ObjectMapper objectMapper;
    private final McpToolRepository mcpToolRepository;
    private final McpResourceRepository mcpResourceRepository;
    private final McpPromptTemplateRepository mcpPromptTemplateRepository;

    private final Map<String, MethodHandler> methodRegistry = new ConcurrentHashMap<>();

    private final Map<String, InitializeResult> initializeCache = new ConcurrentHashMap<>();

    private final ThreadLocal<String> currentLogLevel = ThreadLocal.withInitial(() -> "info");

    @PostConstruct
    void registerHandlers() {
        register("initialize", this::handleInitialize);
        register("ping", req -> EmptyResult.INSTANCE);
        register("roots/list", req -> Map.of("roots", List.of()));

        register("notifications/initialized", this::handleNotificationInitialized);
        register("notifications/cancelled", this::handleNotificationCancelled);

        register("logging/setLevel", this::handleSetLogLevel);

        register("tools/list", this::handleToolsList);
        register("tools/call", this::handleToolsCall);

        register("resources/list", this::handleResourcesList);
        register("resources/read", this::handleResourcesRead);
        register("resources/templates/list", this::handleResourceTemplatesList);
        register("resources/subscribe", this::handleResourcesSubscribe);
        register("resources/unsubscribe", this::handleResourcesUnsubscribe);

        register("prompts/list", this::handlePromptsList);
        register("prompts/get", this::handlePromptsGet);

        register("completion/complete", this::handleCompletionComplete);

        log.info("MCP method registry initialised, total methods={}", methodRegistry.size());
    }

    private void register(String name, MethodHandler handler) {
        methodRegistry.put(name, handler);
    }

    @McpAudit(action = "dispatch")
    public JsonRpcResponse handle(JsonRpcRequest request) {
        if (request == null) {
            return JsonRpcResponse.error(null, CODE_INVALID_REQUEST, "Invalid Request");
        }
        if (request.getMethod() == null || request.getMethod().isBlank()) {
            return JsonRpcResponse.error(request.getId(), CODE_METHOD_NOT_FOUND, "Method not found");
        }
        MethodHandler handler = methodRegistry.get(request.getMethod());
        if (handler == null) {
            return JsonRpcResponse.error(request.getId(), CODE_METHOD_NOT_FOUND,
                    "Method not found: " + request.getMethod());
        }
        try {
            Object result = handler.handle(request);
            if (request.isNotification()) {
                return null;
            }
            return JsonRpcResponse.success(request.getId(), result);
        } catch (McpException e) {
            log.warn("MCP method {} failed: code={}, message={}",
                    request.getMethod(), e.getErrorCode().getCode(), e.getMessage());
            return JsonRpcResponse.error(request.getId(), mapErrorCode(e.getErrorCode()), e.getMessage());
        } catch (IllegalArgumentException e) {
            log.warn("MCP method {} invalid params: {}", request.getMethod(), e.getMessage());
            return JsonRpcResponse.error(request.getId(), CODE_INVALID_PARAMS, e.getMessage());
        } catch (Exception e) {
            log.error("MCP method {} internal error", request.getMethod(), e);
            return JsonRpcResponse.error(request.getId(), CODE_INTERNAL_ERROR, e.getMessage());
        }
    }

    @McpAudit(action = "initialize", targetType = "MCP_SESSION")
    InitializeResult handleInitialize(JsonRpcRequest request) {
        Map<String, Object> params = request.getParams() == null ? Map.of() : request.getParams();
        String clientKey = extractClientKey(params);
        InitializeResult cached = initializeCache.get(clientKey);
        if (cached != null) {
            return cached;
        }
        InitializeResult result = InitializeResult.builder()
                .protocolVersion(PROTOCOL_VERSION)
                .serverInfo(InitializeResult.ServerInfo.builder()
                        .name(SERVER_NAME)
                        .version(SERVER_VERSION)
                        .build())
                .capabilities(InitializeResult.ServerCapabilities.builder()
                        .tools(Map.of("listChanged", Boolean.TRUE))
                        .resources(Map.of("subscribe", Boolean.TRUE, "listChanged", Boolean.TRUE))
                        .prompts(Map.of("listChanged", Boolean.TRUE))
                        .logging(Map.of())
                        .completions(Map.of())
                        .build())
                .build();
        initializeCache.put(clientKey, result);
        return result;
    }

    Object handleNotificationInitialized(JsonRpcRequest request) {
        log.info("MCP client initialized: {}", request.getParams());
        return EmptyResult.INSTANCE;
    }

    Object handleNotificationCancelled(JsonRpcRequest request) {
        Map<String, Object> params = request.getParams() == null ? Map.of() : request.getParams();
        log.info("MCP cancellation requested: requestId={}, reason={}",
                params.get("requestId"), params.get("reason"));
        return EmptyResult.INSTANCE;
    }

    Object handleSetLogLevel(JsonRpcRequest request) {
        Map<String, Object> params = request.getParams() == null ? Map.of() : request.getParams();
        Object levelObj = params.get("level");
        if (levelObj == null) {
            throw new McpException(ErrorCode.INVALID_PARAM, "Missing required param: level");
        }
        String level = String.valueOf(levelObj).toLowerCase();
        if (!SUPPORTED_LOG_LEVELS.contains(level)) {
            throw new McpException(ErrorCode.INVALID_FIELD_VALUE,
                    "Unsupported log level: " + level + " (allowed: " + SUPPORTED_LOG_LEVELS + ")");
        }
        currentLogLevel.set(level);
        log.info("MCP log level set to {}", level);
        return EmptyResult.INSTANCE;
    }

    @McpAudit(action = "tools/list")
    Object handleToolsList(JsonRpcRequest request) {
        Map<String, Object> params = request.getParams() == null ? Map.of() : request.getParams();
        String cursor = asString(params.get("cursor"), null);
        PageWindow page = resolvePage(cursor);
        String tenantId = TenantContext.getOrDefault();

        List<McpToolEntity> tools = mcpToolRepository.search(
                tenantId, null, null, Boolean.TRUE, null, null);

        List<McpToolEntity> slice = sliceByOffset(tools, page.offset, page.size);
        boolean hasMore = page.offset + slice.size() < tools.size();

        List<ToolSchema> toolSchemas = slice.stream()
                .map(this::toToolSchema)
                .toList();

        return ListToolsResult.builder()
                .tools(toolSchemas)
                .nextCursor(hasMore ? encodeCursor(page.offset + slice.size()) : null)
                .build();
    }

    @McpAudit(action = "tools/call")
    Object handleToolsCall(JsonRpcRequest request) {
        Map<String, Object> params = request.getParams();
        if (params == null) {
            throw new McpException(ErrorCode.INVALID_PARAM, "params is required");
        }
        Object nameObj = params.get("name");
        if (nameObj == null || String.valueOf(nameObj).isBlank()) {
            throw new McpException(ErrorCode.INVALID_PARAM, "Missing required param: name");
        }
        String name = String.valueOf(nameObj);

        McpToolEntity tool = mcpToolService.findByCode(name);
        Object arguments = params.get("arguments");
        Map<String, Object> meta = asMap(params.get("_meta"));
        if (arguments == null && meta != null) {
            arguments = meta.get("arguments");
        }
        String input = serializeArguments(arguments);

        try {
            ToolExecutionResponse exec = toolExecutionService.executeTool(tool.getId(), input);
            boolean isError = !"SUCCESS".equals(exec.getStatus());
            String text = isError
                    ? (exec.getErrorMessage() == null ? "execution failed" : exec.getErrorMessage())
                    : (exec.getOutput() == null ? "" : exec.getOutput());

            Content.TextContent contentItem = Content.TextContent.builder()
                    .type("text")
                    .text(text)
                    .build();

            return CallToolResult.builder()
                    .content(List.of(contentItem))
                    .isError(isError)
                    .build();
        } catch (McpException e) {
            throw e;
        } catch (Exception e) {
            Content.TextContent errorItem = Content.TextContent.builder()
                    .type("text")
                    .text("tool execution failed: " + e.getMessage())
                    .build();
            return CallToolResult.builder()
                    .content(List.of(errorItem))
                    .isError(true)
                    .build();
        }
    }

    @McpAudit(action = "resources/list")
    Object handleResourcesList(JsonRpcRequest request) {
        Map<String, Object> params = request.getParams() == null ? Map.of() : request.getParams();
        String cursor = asString(params.get("cursor"), null);
        PageWindow page = resolvePage(cursor);
        String tenantId = TenantContext.getOrDefault();

        List<McpResourceEntity> resources = mcpResourceRepository.search(tenantId, null, null);
        List<McpResourceEntity> slice = sliceByOffset(resources, page.offset, page.size);
        boolean hasMore = page.offset + slice.size() < resources.size();

        List<ResourceSchema> schemas = slice.stream()
                .map(this::toResourceSchema)
                .toList();

        return ListResourcesResult.builder()
                .resources(schemas)
                .nextCursor(hasMore ? encodeCursor(page.offset + slice.size()) : null)
                .build();
    }

    @McpAudit(action = "resources/read")
    Object handleResourcesRead(JsonRpcRequest request) {
        Map<String, Object> params = request.getParams();
        if (params == null) {
            throw new McpException(ErrorCode.INVALID_PARAM, "params is required");
        }
        Object uriObj = params.get("uri");
        if (uriObj == null || String.valueOf(uriObj).isBlank()) {
            throw new McpException(ErrorCode.INVALID_PARAM, "Missing required param: uri");
        }
        String uri = String.valueOf(uriObj);
        String tenantId = TenantContext.getOrDefault();

        McpResourceEntity entity = mcpResourceRepository
                .findByTenantIdAndUriAndDeletedAtIsNull(tenantId, uri)
                .orElseThrow(() -> new McpException(ErrorCode.RESOURCE_NOT_FOUND,
                        "MCP Resource not found: " + uri));

        ResourceContent content = ResourceContent.builder()
                .uri(entity.getUri())
                .mimeType(entity.getMimeType() == null ? "text/plain" : entity.getMimeType())
                .text(entity.getContent() == null ? "" : entity.getContent())
                .build();

        return ReadResourceResult.builder()
                .contents(List.of(content))
                .build();
    }

    Object handleResourceTemplatesList(JsonRpcRequest request) {
        return ListResourceTemplatesResult.builder()
                .resourceTemplates(List.of())
                .build();
    }

    @McpAudit(action = "resources/subscribe")
    Object handleResourcesSubscribe(JsonRpcRequest request) {
        Map<String, Object> params = request.getParams() == null ? Map.of() : request.getParams();
        Object uri = params.get("uri");
        if (uri == null) {
            throw new McpException(ErrorCode.INVALID_PARAM, "Missing required param: uri");
        }
        log.info("Resource subscribe requested: uri={}", uri);
        return EmptyResult.INSTANCE;
    }

    Object handleResourcesUnsubscribe(JsonRpcRequest request) {
        Map<String, Object> params = request.getParams() == null ? Map.of() : request.getParams();
        Object uri = params.get("uri");
        if (uri == null) {
            throw new McpException(ErrorCode.INVALID_PARAM, "Missing required param: uri");
        }
        log.info("Resource unsubscribe requested: uri={}", uri);
        return EmptyResult.INSTANCE;
    }

    @McpAudit(action = "prompts/list")
    Object handlePromptsList(JsonRpcRequest request) {
        Map<String, Object> params = request.getParams() == null ? Map.of() : request.getParams();
        String cursor = asString(params.get("cursor"), null);
        PageWindow page = resolvePage(cursor);
        String tenantId = TenantContext.getOrDefault();

        List<McpPromptTemplateEntity> templates =
                mcpPromptTemplateRepository.search(tenantId, "ACTIVE", null, null);
        List<McpPromptTemplateEntity> slice = sliceByOffset(templates, page.offset, page.size);
        boolean hasMore = page.offset + slice.size() < templates.size();

        List<PromptSchema> schemas = slice.stream()
                .map(this::toPromptSchema)
                .toList();

        return ListPromptsResult.builder()
                .prompts(schemas)
                .nextCursor(hasMore ? encodeCursor(page.offset + slice.size()) : null)
                .build();
    }

    @McpAudit(action = "prompts/get")
    Object handlePromptsGet(JsonRpcRequest request) {
        Map<String, Object> params = request.getParams();
        if (params == null) {
            throw new McpException(ErrorCode.INVALID_PARAM, "params is required");
        }
        Object nameObj = params.get("name");
        if (nameObj == null || String.valueOf(nameObj).isBlank()) {
            throw new McpException(ErrorCode.INVALID_PARAM, "Missing required param: name");
        }
        String name = String.valueOf(nameObj);
        Map<String, Object> arguments = asMap(params.get("arguments"));
        String tenantId = TenantContext.getOrDefault();

        McpPromptTemplateEntity template = findPromptByName(tenantId, name);
        // renderTemplate is package-private in PromptTemplateService; reuse the public render(id, vars) entry point.
        String rendered = promptTemplateService.render(template.getId(), arguments).get("rendered").toString();

        Content.TextContent content = Content.TextContent.builder()
                .type("text")
                .text(rendered)
                .build();

        PromptMessage message = PromptMessage.builder()
                .role("user")
                .content(content)
                .build();

        return GetPromptResult.builder()
                .description(template.getDescription())
                .messages(List.of(message))
                .build();
    }

    Object handleCompletionComplete(JsonRpcRequest request) {
        Map<String, Object> params = request.getParams() == null ? Map.of() : request.getParams();
        Map<String, Object> ref = asMap(params.get("ref"));
        Map<String, Object> argument = asMap(params.get("argument"));

        String value = asString(argument.get("value"), "");
        List<String> candidates = generateCompletions(ref, value);

        return CompletionResult.builder()
                .completion(CompletionResult.Completion.builder()
                        .values(candidates)
                        .total(candidates.size())
                        .hasMore(Boolean.FALSE)
                        .build())
                .build();
    }

    private ToolSchema toToolSchema(McpToolEntity tool) {
        return ToolSchema.builder()
                .name(tool.getCode())
                .title(tool.getName())
                .description(tool.getDescription() == null ? "" : tool.getDescription())
                .inputSchema(parseJson(tool.getInputSchema()))
                .build();
    }

    private ResourceSchema toResourceSchema(McpResourceEntity entity) {
        return ResourceSchema.builder()
                .uri(entity.getUri())
                .name(entity.getName())
                .description(entity.getDescription())
                .mimeType(entity.getMimeType())
                .build();
    }

    private PromptSchema toPromptSchema(McpPromptTemplateEntity entity) {
        List<PromptArgument> args = extractPromptArguments(entity.getTemplate());
        return PromptSchema.builder()
                .name(entity.getName())
                .title(entity.getName())
                .description(entity.getDescription())
                .arguments(args)
                .build();
    }

    private List<PromptArgument> extractPromptArguments(String template) {
        if (template == null || template.isBlank()) {
            return List.of();
        }
        Matcher matcher = VAR_PATTERN.matcher(template);
        List<PromptArgument> args = new ArrayList<>();
        java.util.Set<String> seen = new java.util.LinkedHashSet<>();
        while (matcher.find()) {
            String varName = matcher.group(1);
            if (seen.add(varName)) {
                args.add(PromptArgument.builder()
                        .name(varName)
                        .required(Boolean.TRUE)
                        .build());
            }
        }
        return args;
    }

    private McpPromptTemplateEntity findPromptByName(String tenantId, String name) {
        List<McpPromptTemplateEntity> matches =
                mcpPromptTemplateRepository.search(tenantId, null, null, name);
        for (McpPromptTemplateEntity entity : matches) {
            if (Objects.equals(entity.getName(), name)) {
                return entity;
            }
        }
        throw new McpException(ErrorCode.PROMPT_TEMPLATE_NOT_FOUND,
                "Prompt 模板不存在: " + name);
    }

    private List<String> generateCompletions(Map<String, Object> ref, String value) {
        String type = ref == null ? "" : asString(ref.get("type"), "");
        if ("ref/prompt".equals(type)) {
            String tenantId = TenantContext.getOrDefault();
            return mcpPromptTemplateRepository.search(tenantId, "ACTIVE", null, value).stream()
                    .map(McpPromptTemplateEntity::getName)
                    .filter(n -> n != null && n.toLowerCase().contains(value.toLowerCase()))
                    .limit(20)
                    .toList();
        }
        if ("ref/resource".equals(type)) {
            String tenantId = TenantContext.getOrDefault();
            return mcpResourceRepository.search(tenantId, null, value).stream()
                    .map(McpResourceEntity::getUri)
                    .filter(u -> u != null && u.toLowerCase().contains(value.toLowerCase()))
                    .limit(20)
                    .toList();
        }
        if (value == null || value.isBlank()) {
            return List.of();
        }
        return List.of(value);
    }

    private Map<String, Object> parseJson(String value) {
        if (value == null || value.isBlank()) {
            return Collections.emptyMap();
        }
        try {
            JsonNode node = objectMapper.readTree(value);
            return objectMapper.treeToValue(node, new TypeReference<Map<String, Object>>() {
            });
        } catch (Exception e) {
            return Collections.emptyMap();
        }
    }

    private String serializeArguments(Object arguments) {
        if (arguments == null) {
            return "{}";
        }
        try {
            if (arguments instanceof String s) {
                return s;
            }
            return objectMapper.writeValueAsString(arguments);
        } catch (Exception e) {
            return "{}";
        }
    }

    private String extractClientKey(Map<String, Object> params) {
        Object clientInfo = params.get("clientInfo");
        if (clientInfo instanceof Map<?, ?> ci) {
            Object name = ci.get("name");
            Object version = ci.get("version");
            return (name == null ? "anonymous" : name) + "@" + (version == null ? "0" : version);
        }
        return "anonymous@" + Thread.currentThread().getId();
    }

    private int mapErrorCode(ErrorCode code) {
        if (code == null) {
            return CODE_INTERNAL_ERROR;
        }
        return switch (code) {
            case INVALID_PARAM, INVALID_FIELD_VALUE -> CODE_INVALID_PARAMS;
            case NOT_FOUND, SERVER_NOT_FOUND, TOOL_NOT_FOUND, CLIENT_NOT_FOUND,
                 EXECUTION_NOT_FOUND, RESOURCE_NOT_FOUND, PROMPT_TEMPLATE_NOT_FOUND,
                 AUDIT_LOG_NOT_FOUND, EVENT_SUBSCRIPTION_NOT_FOUND, POSITION_NOT_FOUND,
                 TOOL_CATEGORY_NOT_FOUND, DEBUG_SESSION_NOT_FOUND, ALERT_RULE_NOT_FOUND,
                 EXTERNAL_AGENT_NOT_FOUND, AGENT_TRUST_NOT_FOUND, COLLABORATION_NOT_FOUND -> CODE_SERVER_ERROR;
            case STATE_CONFLICT, ALREADY_EXISTS, TOOL_NOT_ENABLED, SERVER_NOT_ACTIVE -> CODE_SERVER_ERROR;
            default -> CODE_INTERNAL_ERROR;
        };
    }

    private PageWindow resolvePage(String cursor) {
        if (cursor == null || cursor.isBlank()) {
            return new PageWindow(0, DEFAULT_PAGE_SIZE);
        }
        try {
            int offset = Integer.parseInt(cursor);
            if (offset < 0) offset = 0;
            return new PageWindow(offset, DEFAULT_PAGE_SIZE);
        } catch (NumberFormatException e) {
            return new PageWindow(0, DEFAULT_PAGE_SIZE);
        }
    }

    private <T> List<T> sliceByOffset(List<T> all, int offset, int size) {
        if (all == null || all.isEmpty()) {
            return List.of();
        }
        if (offset >= all.size()) {
            return List.of();
        }
        int end = Math.min(offset + size, all.size());
        return all.subList(offset, end);
    }

    private String encodeCursor(int nextOffset) {
        return Integer.toString(nextOffset);
    }

    private String asString(Object value, String defaultValue) {
        if (value == null) return defaultValue;
        return String.valueOf(value);
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> asMap(Object value) {
        if (value instanceof Map<?, ?> m) {
            return (Map<String, Object>) m;
        }
        return null;
    }

    private record PageWindow(int offset, int size) {
        PageWindow {
            if (size <= 0) size = DEFAULT_PAGE_SIZE;
            if (size > MAX_PAGE_SIZE) size = MAX_PAGE_SIZE;
        }
    }

    @FunctionalInterface
    public interface MethodHandler {
        Object handle(JsonRpcRequest request);
    }

    public Set<String> registeredMethods() {
        return Collections.unmodifiableSet(methodRegistry.keySet());
    }

    public List<String> methodNames() {
        return Arrays.stream(methodRegistry.keySet().toArray(new String[0]))
                .sorted()
                .collect(Collectors.toList());
    }
}