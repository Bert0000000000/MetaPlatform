package com.metaplatform.mcp.client.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.mcp.client.dto.CreateMcpClientRequest;
import com.metaplatform.mcp.client.dto.McpClientResponse;
import com.metaplatform.mcp.client.dto.UpdateMcpClientRequest;
import com.metaplatform.mcp.client.entity.McpClientConnectionEntity;
import com.metaplatform.mcp.client.repository.McpClientConnectionRepository;
import com.metaplatform.mcp.common.ErrorCode;
import com.metaplatform.mcp.common.PageResponse;
import com.metaplatform.mcp.common.TenantContext;
import com.metaplatform.mcp.exception.McpException;
import com.metaplatform.mcp.tool.dto.McpToolListItem;
import com.metaplatform.mcp.tool.entity.McpToolEntity;
import com.metaplatform.mcp.tool.repository.McpToolRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.reactive.function.client.WebClient;

import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class McpClientService {

    private static final String STATUS_CONNECTED = "CONNECTED";
    private static final String STATUS_DISCONNECTED = "DISCONNECTED";
    private static final Duration HTTP_TIMEOUT = Duration.ofSeconds(30);
    private static final String TOOL_TYPE_MCP = "MCP";

    private final McpClientConnectionRepository clientRepository;
    private final McpToolRepository mcpToolRepository;
    private final ObjectMapper objectMapper;
    private final WebClient.Builder webClientBuilder;

    @Transactional
    public McpClientResponse create(CreateMcpClientRequest request) {
        String tenantId = TenantContext.getOrDefault();
        if (clientRepository.existsByTenantIdAndNameAndDeletedAtIsNull(tenantId, request.getName())) {
            throw new McpException(ErrorCode.ALREADY_EXISTS, "MCP Client name 在该租户下已存在");
        }
        validateJson(request.getConfig(), "config");
        validateJson(request.getHeaders(), "headers");
        validateJson(request.getServerIds(), "serverIds");

        Instant now = Instant.now();
        String serverUrl = request.getServerUrl();
        String baseUrl = request.getBaseUrl() != null ? request.getBaseUrl() : serverUrl;
        McpClientConnectionEntity entity = McpClientConnectionEntity.builder()
                .tenantId(tenantId)
                .name(request.getName())
                .serverUrl(serverUrl)
                .baseUrl(baseUrl)
                .clientType(request.getClientType())
                .transportType(request.getTransportType() == null ? "HTTP" : request.getTransportType().toUpperCase())
                .status(STATUS_DISCONNECTED)
                .authType(request.getAuthType())
                .authToken(request.getAuthToken())
                .timeoutMs(request.getTimeoutMs())
                .headers(normalizeJson(request.getHeaders(), "{}"))
                .serverIds(normalizeJson(request.getServerIds(), "[]"))
                .config(normalizeJson(request.getConfig(), "{}"))
                .createdAt(now)
                .updatedAt(now)
                .build();
        return toResponse(clientRepository.save(entity));
    }

    @Transactional(readOnly = true)
    public PageResponse<McpClientResponse> list(String status, String keyword, Integer page, Integer size) {
        String tenantId = TenantContext.getOrDefault();
        int p = page == null || page < 1 ? 1 : page;
        int s = size == null || size < 1 ? 20 : Math.min(size, 100);
        Pageable pageable = PageRequest.of(p - 1, s, Sort.by(Sort.Direction.DESC, "updatedAt"));

        Page<McpClientConnectionEntity> result = clientRepository.search(tenantId, status, keyword, pageable);
        return PageResponse.<McpClientResponse>builder()
                .items(result.getContent().stream().map(this::toResponse).toList())
                .total(result.getTotalElements())
                .page(p)
                .size(s)
                .totalPages(result.getTotalPages())
                .build();
    }

    @Transactional(readOnly = true)
    public McpClientResponse get(UUID id) {
        return toResponse(findById(id));
    }

    @Transactional
    public McpClientResponse update(UUID id, UpdateMcpClientRequest request) {
        McpClientConnectionEntity entity = findById(id);
        if (request.getName() != null) {
            entity.setName(request.getName());
        }
        if (request.getServerUrl() != null) {
            entity.setServerUrl(request.getServerUrl());
        }
        if (request.getBaseUrl() != null) {
            entity.setBaseUrl(request.getBaseUrl());
        }
        if (request.getClientType() != null) {
            entity.setClientType(request.getClientType());
        }
        if (request.getTransportType() != null) {
            entity.setTransportType(request.getTransportType().toUpperCase());
        }
        if (request.getAuthType() != null) {
            entity.setAuthType(request.getAuthType());
        }
        if (request.getAuthToken() != null) {
            entity.setAuthToken(request.getAuthToken());
        }
        if (request.getTimeoutMs() != null) {
            entity.setTimeoutMs(request.getTimeoutMs());
        }
        if (request.getHeaders() != null) {
            validateJson(request.getHeaders(), "headers");
            entity.setHeaders(request.getHeaders());
        }
        if (request.getServerIds() != null) {
            validateJson(request.getServerIds(), "serverIds");
            entity.setServerIds(request.getServerIds());
        }
        if (request.getConfig() != null) {
            validateJson(request.getConfig(), "config");
            entity.setConfig(request.getConfig());
        }
        entity.setUpdatedAt(Instant.now());
        return toResponse(clientRepository.save(entity));
    }

    @Transactional
    public void delete(UUID id) {
        McpClientConnectionEntity entity = findById(id);
        entity.setDeletedAt(Instant.now());
        entity.setUpdatedAt(Instant.now());
        clientRepository.save(entity);
    }

    @Transactional
    public McpClientResponse testConnection(UUID id) {
        McpClientConnectionEntity entity = findById(id);
        String endpoint = effectiveUrl(entity);
        try {
            JsonNode result = callJsonRpc(endpoint, "initialize", entity);
            if (result != null && result.has("protocolVersion")) {
                entity.setStatus(STATUS_CONNECTED);
                entity.setLastConnectedAt(Instant.now());
            } else {
                entity.setStatus(STATUS_DISCONNECTED);
            }
        } catch (Exception e) {
            log.warn("MCP Client connection test failed for {}: {}", endpoint, e.getMessage());
            entity.setStatus(STATUS_DISCONNECTED);
        }
        entity.setUpdatedAt(Instant.now());
        return toResponse(clientRepository.save(entity));
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getStatus(UUID id) {
        McpClientConnectionEntity entity = findById(id);
        Map<String, Object> status = new LinkedHashMap<>();
        status.put("id", entity.getId());
        status.put("name", entity.getName());
        status.put("status", entity.getStatus());
        status.put("connected", STATUS_CONNECTED.equals(entity.getStatus()));
        status.put("lastConnectedAt", entity.getLastConnectedAt());
        status.put("serverUrl", entity.getServerUrl());
        return status;
    }

    @Transactional
    public List<McpToolListItem> discoverTools(UUID id) {
        McpClientConnectionEntity entity = findById(id);
        String tenantId = entity.getTenantId();
        String endpoint = effectiveUrl(entity);
        JsonNode result;
        try {
            result = callJsonRpc(endpoint, "tools/list", entity);
        } catch (Exception e) {
            throw new McpException(ErrorCode.DISCOVERY_ERROR,
                    "MCP 工具发现失败: " + e.getMessage());
        }
        if (result == null || !result.has("tools")) {
            throw new McpException(ErrorCode.DISCOVERY_ERROR, "远程服务器未返回 tools 列表");
        }
        JsonNode toolsNode = result.get("tools");
        Instant now = Instant.now();
        for (JsonNode toolNode : toolsNode) {
            upsertDiscoveredTool(tenantId, entity.getId(), endpoint, toolNode, now);
        }
        entity.setStatus(STATUS_CONNECTED);
        entity.setLastConnectedAt(now);
        entity.setUpdatedAt(now);
        clientRepository.save(entity);

        return mcpToolRepository.findByTenantIdAndServerIdAndDeletedAtIsNull(tenantId, id).stream()
                .filter(t -> TOOL_TYPE_MCP.equals(t.getToolType()))
                .map(this::toListItem)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<McpToolListItem> getDiscoveredTools(UUID id) {
        String tenantId = TenantContext.getOrDefault();
        findById(id);
        return mcpToolRepository.findByTenantIdAndServerIdAndDeletedAtIsNull(tenantId, id).stream()
                .filter(t -> TOOL_TYPE_MCP.equals(t.getToolType()))
                .map(this::toListItem)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<McpToolListItem> getTools(UUID id) {
        return getDiscoveredTools(id);
    }

    McpClientConnectionEntity findById(UUID id) {
        String tenantId = TenantContext.getOrDefault();
        return clientRepository.findByIdAndDeletedAtIsNull(id)
                .filter(e -> e.getTenantId().equals(tenantId))
                .orElseThrow(() -> new McpException(ErrorCode.CLIENT_NOT_FOUND, "MCP Client 不存在"));
    }

    private void upsertDiscoveredTool(String tenantId, UUID clientId, String serverUrl,
                                      JsonNode toolNode, Instant now) {
        String code = textOr(toolNode, "name", "unknown_tool");
        String name = textOr(toolNode, "title", code);
        String description = textOr(toolNode, "description", "");
        String inputSchema = toolNode.has("inputSchema")
                ? toolNode.get("inputSchema").toString()
                : "{}";

        McpToolEntity entity = mcpToolRepository
                .findByTenantIdAndCodeAndDeletedAtIsNull(tenantId, code)
                .orElseGet(() -> McpToolEntity.builder()
                        .tenantId(tenantId)
                        .code(code)
                        .createdAt(now)
                        .build());
        entity.setServerId(clientId);
        entity.setName(name);
        entity.setDescription(description);
        entity.setInputSchema(inputSchema);
        entity.setOutputSchema("{}");
        entity.setToolType(TOOL_TYPE_MCP);
        entity.setEndpoint(serverUrl);
        entity.setEnabled(Boolean.TRUE);
        entity.setUpdatedAt(now);
        mcpToolRepository.save(entity);
    }

    private JsonNode callJsonRpc(String serverUrl, String method,
                                  McpClientConnectionEntity connection) throws Exception {
        Map<String, Object> request = new LinkedHashMap<>();
        request.put("jsonrpc", "2.0");
        request.put("id", 1);
        request.put("method", method);
        request.put("params", Map.of());
        String body = objectMapper.writeValueAsString(request);

        Duration timeout = connection.getTimeoutMs() != null && connection.getTimeoutMs() > 0
                ? Duration.ofMillis(connection.getTimeoutMs())
                : HTTP_TIMEOUT;

        WebClient.RequestBodySpec postSpec = webClientBuilder.build().post()
                .uri(serverUrl)
                .contentType(MediaType.APPLICATION_JSON)
                .accept(MediaType.APPLICATION_JSON);

        applyHeaders(postSpec, connection);

        String response = postSpec.bodyValue(body)
                .retrieve()
                .bodyToMono(String.class)
                .block(timeout);
        if (response == null) {
            throw new McpException(ErrorCode.CLIENT_CONNECTION_ERROR, "远程服务器无响应");
        }
        JsonNode root = objectMapper.readTree(response);
        if (root.has("error")) {
            JsonNode err = root.get("error");
            throw new McpException(ErrorCode.CLIENT_CONNECTION_ERROR,
                    "远程服务器返回错误: " + textOr(err, "message", "unknown"));
        }
        return root.has("result") ? root.get("result") : null;
    }

    private void applyHeaders(WebClient.RequestBodySpec postSpec,
                              McpClientConnectionEntity connection) {
        if (connection.getAuthToken() != null && !connection.getAuthToken().isBlank()) {
            if ("bearer".equalsIgnoreCase(connection.getAuthType())) {
                postSpec.header("Authorization", "Bearer " + connection.getAuthToken());
            } else {
                postSpec.header("Authorization", connection.getAuthToken());
            }
        }
        if (connection.getHeaders() != null && !connection.getHeaders().isBlank()) {
            try {
                JsonNode headersNode = objectMapper.readTree(connection.getHeaders());
                headersNode.fields().forEachRemaining(entry -> {
                    if (!entry.getValue().isNull()) {
                        postSpec.header(entry.getKey(), entry.getValue().asText());
                    }
                });
            } catch (Exception e) {
                log.warn("无法解析 Client headers JSON: {}", connection.getHeaders());
            }
        }
    }

    private String effectiveUrl(McpClientConnectionEntity entity) {
        return entity.getBaseUrl() != null && !entity.getBaseUrl().isBlank()
                ? entity.getBaseUrl()
                : entity.getServerUrl();
    }

    private String textOr(JsonNode node, String field, String defaultValue) {
        JsonNode child = node.get(field);
        if (child == null || child.isNull()) {
            return defaultValue;
        }
        return child.asText();
    }

    private McpClientResponse toResponse(McpClientConnectionEntity entity) {
        return McpClientResponse.builder()
                .id(entity.getId())
                .name(entity.getName())
                .serverUrl(entity.getServerUrl())
                .baseUrl(entity.getBaseUrl())
                .clientType(entity.getClientType())
                .transportType(entity.getTransportType())
                .status(entity.getStatus())
                .authType(entity.getAuthType())
                .authToken(entity.getAuthToken())
                .timeoutMs(entity.getTimeoutMs())
                .headers(entity.getHeaders())
                .serverIds(entity.getServerIds())
                .lastConnectedAt(entity.getLastConnectedAt())
                .config(entity.getConfig())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }

    private McpToolListItem toListItem(McpToolEntity entity) {
        return McpToolListItem.builder()
                .id(entity.getId())
                .serverId(entity.getServerId())
                .name(entity.getName())
                .code(entity.getCode())
                .description(entity.getDescription())
                .inputSchema(entity.getInputSchema())
                .toolType(entity.getToolType())
                .enabled(entity.getEnabled())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }

    private void validateJson(String value, String field) {
        if (value == null || value.isBlank()) {
            return;
        }
        try {
            objectMapper.readTree(value);
        } catch (Exception e) {
            throw new McpException(ErrorCode.INVALID_PARAM, field + " 不是合法的 JSON");
        }
    }

    private String normalizeJson(String value, String defaultValue) {
        if (value == null || value.isBlank()) {
            return defaultValue;
        }
        return value;
    }
}
