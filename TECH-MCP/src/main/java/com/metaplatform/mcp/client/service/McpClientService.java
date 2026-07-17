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

        Instant now = Instant.now();
        McpClientConnectionEntity entity = McpClientConnectionEntity.builder()
                .tenantId(tenantId)
                .name(request.getName())
                .serverUrl(request.getServerUrl())
                .transportType(request.getTransportType() == null ? "HTTP" : request.getTransportType().toUpperCase())
                .status(STATUS_DISCONNECTED)
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
        if (request.getTransportType() != null) {
            entity.setTransportType(request.getTransportType().toUpperCase());
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
        try {
            JsonNode result = callJsonRpc(entity.getServerUrl(), "initialize");
            if (result != null && result.has("protocolVersion")) {
                entity.setStatus(STATUS_CONNECTED);
                entity.setLastConnectedAt(Instant.now());
            } else {
                entity.setStatus(STATUS_DISCONNECTED);
            }
        } catch (Exception e) {
            log.warn("MCP Client connection test failed for {}: {}", entity.getServerUrl(), e.getMessage());
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
        JsonNode result;
        try {
            result = callJsonRpc(entity.getServerUrl(), "tools/list");
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
            upsertDiscoveredTool(tenantId, entity.getId(), entity.getServerUrl(), toolNode, now);
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

    private JsonNode callJsonRpc(String serverUrl, String method) throws Exception {
        Map<String, Object> request = new LinkedHashMap<>();
        request.put("jsonrpc", "2.0");
        request.put("id", 1);
        request.put("method", method);
        request.put("params", Map.of());
        String body = objectMapper.writeValueAsString(request);
        String response = webClientBuilder.build().post()
                .uri(serverUrl)
                .contentType(MediaType.APPLICATION_JSON)
                .accept(MediaType.APPLICATION_JSON)
                .bodyValue(body)
                .retrieve()
                .bodyToMono(String.class)
                .block(HTTP_TIMEOUT);
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
                .transportType(entity.getTransportType())
                .status(entity.getStatus())
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
