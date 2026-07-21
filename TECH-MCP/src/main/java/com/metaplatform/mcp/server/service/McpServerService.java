package com.metaplatform.mcp.server.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.mcp.common.ErrorCode;
import com.metaplatform.mcp.common.PageResponse;
import com.metaplatform.mcp.common.TenantContext;
import com.metaplatform.mcp.exception.McpException;
import com.metaplatform.mcp.server.dto.ConnectionStatusResponse;
import com.metaplatform.mcp.server.dto.CreateMcpServerRequest;
import com.metaplatform.mcp.server.dto.IdeConfigResponse;
import com.metaplatform.mcp.server.dto.McpServerListItem;
import com.metaplatform.mcp.server.dto.McpServerResponse;
import com.metaplatform.mcp.server.dto.ServerStatusResponse;
import com.metaplatform.mcp.server.dto.UpdateMcpServerRequest;
import com.metaplatform.mcp.server.entity.McpServerEntity;
import com.metaplatform.mcp.server.repository.McpServerRepository;
import com.metaplatform.mcp.tool.entity.McpToolEntity;
import com.metaplatform.mcp.tool.repository.McpToolRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class McpServerService {

    private static final String STATUS_ACTIVE = "ACTIVE";
    private static final String STATUS_INACTIVE = "INACTIVE";
    private static final String STATUS_ERROR = "ERROR";

    private static final String CONNECTION_ONLINE = "online";
    private static final String CONNECTION_OFFLINE = "offline";
    private static final String CONNECTION_ERROR = "error";

    private final McpServerRepository mcpServerRepository;
    private final McpToolRepository mcpToolRepository;
    private final ObjectMapper objectMapper;

    @Transactional
    public McpServerResponse create(CreateMcpServerRequest request) {
        String tenantId = TenantContext.getOrDefault();
        if (mcpServerRepository.existsByTenantIdAndCodeAndDeletedAtIsNull(tenantId, request.getCode())) {
            throw new McpException(ErrorCode.ALREADY_EXISTS, "MCP Server code 在该租户下已存在");
        }
        validateJson(request.getConfig(), "config");
        validateJson(request.getAuthConfig(), "authConfig");

        Instant now = Instant.now();
        McpServerEntity entity = McpServerEntity.builder()
                .tenantId(tenantId)
                .name(request.getName())
                .code(request.getCode())
                .description(request.getDescription())
                .transportType(request.getTransportType().toUpperCase())
                .endpointUrl(request.getEndpointUrl())
                .host(request.getHost())
                .port(request.getPort())
                .sseEndpoint(request.getSseEndpoint())
                .authType(normalizeAuthType(request.getAuthType()))
                .authConfig(normalizeJson(request.getAuthConfig(), "{}"))
                .timeoutMs(request.getTimeoutMs())
                .maxConcurrentCalls(request.getMaxConcurrentCalls())
                .healthCheckUrl(request.getHealthCheckUrl())
                .status(STATUS_INACTIVE)
                .config(normalizeJson(request.getConfig(), "{}"))
                .createdAt(now)
                .updatedAt(now)
                .build();
        McpServerEntity saved = mcpServerRepository.save(entity);
        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public PageResponse<McpServerListItem> list(String status, String keyword, Integer page, Integer size) {
        String tenantId = TenantContext.getOrDefault();
        int p = page == null || page < 1 ? 1 : page;
        int s = size == null || size < 1 ? 20 : Math.min(size, 100);
        Pageable pageable = PageRequest.of(p - 1, s, Sort.by(Sort.Direction.DESC, "updatedAt"));

        Page<McpServerEntity> result = mcpServerRepository.search(tenantId, status, keyword, pageable);
        return PageResponse.<McpServerListItem>builder()
                .items(result.getContent().stream().map(this::toListItem).toList())
                .total(result.getTotalElements())
                .page(p)
                .size(s)
                .totalPages(result.getTotalPages())
                .build();
    }

    @Transactional(readOnly = true)
    public McpServerResponse get(UUID id) {
        McpServerEntity entity = findById(id);
        return toResponse(entity);
    }

    @Transactional
    public McpServerResponse update(UUID id, UpdateMcpServerRequest request) {
        McpServerEntity entity = findById(id);
        if (request.getName() != null) {
            entity.setName(request.getName());
        }
        if (request.getDescription() != null) {
            entity.setDescription(request.getDescription());
        }
        if (request.getTransportType() != null) {
            entity.setTransportType(request.getTransportType().toUpperCase());
        }
        if (request.getEndpointUrl() != null) {
            entity.setEndpointUrl(request.getEndpointUrl());
        }
        if (request.getHost() != null) {
            entity.setHost(request.getHost());
        }
        if (request.getPort() != null) {
            entity.setPort(request.getPort());
        }
        if (request.getSseEndpoint() != null) {
            entity.setSseEndpoint(request.getSseEndpoint());
        }
        if (request.getAuthType() != null) {
            entity.setAuthType(normalizeAuthType(request.getAuthType()));
        }
        if (request.getAuthConfig() != null) {
            validateJson(request.getAuthConfig(), "authConfig");
            entity.setAuthConfig(request.getAuthConfig());
        }
        if (request.getTimeoutMs() != null) {
            entity.setTimeoutMs(request.getTimeoutMs());
        }
        if (request.getMaxConcurrentCalls() != null) {
            entity.setMaxConcurrentCalls(request.getMaxConcurrentCalls());
        }
        if (request.getHealthCheckUrl() != null) {
            entity.setHealthCheckUrl(request.getHealthCheckUrl());
        }
        if (request.getConfig() != null) {
            validateJson(request.getConfig(), "config");
            entity.setConfig(request.getConfig());
        }
        entity.setUpdatedAt(Instant.now());
        McpServerEntity saved = mcpServerRepository.save(entity);
        return toResponse(saved);
    }

    @Transactional
    public void delete(UUID id) {
        McpServerEntity entity = findById(id);
        entity.setDeletedAt(Instant.now());
        entity.setUpdatedAt(Instant.now());
        mcpServerRepository.save(entity);
    }

    @Transactional
    public McpServerResponse start(UUID id) {
        McpServerEntity entity = findById(id);
        if (STATUS_ACTIVE.equals(entity.getStatus())) {
            throw new McpException(ErrorCode.STATE_CONFLICT, "MCP Server 已激活");
        }
        entity.setStatus(STATUS_ACTIVE);
        entity.setLastHeartbeatAt(Instant.now());
        entity.setLastErrorMessage(null);
        entity.setUpdatedAt(Instant.now());
        return toResponse(mcpServerRepository.save(entity));
    }

    @Transactional
    public McpServerResponse stop(UUID id) {
        McpServerEntity entity = findById(id);
        if (STATUS_INACTIVE.equals(entity.getStatus())) {
            throw new McpException(ErrorCode.STATE_CONFLICT, "MCP Server 已停用");
        }
        entity.setStatus(STATUS_INACTIVE);
        entity.setUpdatedAt(Instant.now());
        return toResponse(mcpServerRepository.save(entity));
    }

    @Transactional
    public McpServerResponse restart(UUID id) {
        McpServerEntity entity = findById(id);
        entity.setStatus(STATUS_ACTIVE);
        entity.setLastHeartbeatAt(Instant.now());
        entity.setLastErrorMessage(null);
        entity.setUpdatedAt(Instant.now());
        return toResponse(mcpServerRepository.save(entity));
    }

    @Transactional(readOnly = true)
    public ServerStatusResponse status(UUID id) {
        McpServerEntity entity = findById(id);
        return ServerStatusResponse.builder()
                .status(entity.getStatus())
                .connectionStatus(toConnectionStatus(entity.getStatus()))
                .lastHeartbeatAt(entity.getLastHeartbeatAt())
                .lastErrorMessage(entity.getLastErrorMessage())
                .healthCheckUrl(entity.getHealthCheckUrl())
                .build();
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getCapabilities(UUID id) {
        McpServerEntity entity = findById(id);
        List<McpToolEntity> tools = mcpToolRepository
                .findByTenantIdAndServerIdAndDeletedAtIsNull(entity.getTenantId(), id);
        return Map.of(
                "server", Map.of(
                        "id", entity.getId(),
                        "name", entity.getName(),
                        "code", entity.getCode(),
                        "transportType", entity.getTransportType(),
                        "status", entity.getStatus()
                ),
                "tools", tools.stream().map(t -> Map.of(
                        "id", t.getId(),
                        "name", t.getName(),
                        "code", t.getCode(),
                        "toolType", t.getToolType(),
                        "enabled", t.getEnabled()
                )).toList(),
                "toolCount", tools.size()
        );
    }

    @Transactional(readOnly = true)
    public IdeConfigResponse generateIdeConfig(UUID id, String ideType) {
        McpServerEntity entity = findById(id);
        String normalizedIde = normalizeIdeType(ideType);
        String content = buildIdeConfigContent(entity, normalizedIde);
        return IdeConfigResponse.builder()
                .ideType(normalizedIde)
                .fileName(buildFileName(entity, normalizedIde))
                .contentType("application/json")
                .content(content)
                .build();
    }

    @Transactional(readOnly = true)
    public ConnectionStatusResponse getConnectionStatus(UUID id) {
        McpServerEntity entity = findById(id);
        return ConnectionStatusResponse.builder()
                .id(entity.getId())
                .name(entity.getName())
                .type("server")
                .transportType(entity.getTransportType())
                .status(entity.getStatus())
                .connectionStatus(toConnectionStatus(entity.getStatus()))
                .lastHeartbeatAt(entity.getLastHeartbeatAt())
                .lastErrorMessage(entity.getLastErrorMessage())
                .errorRate(0.0)
                .latencyMs(entity.getTimeoutMs() != null ? entity.getTimeoutMs().longValue() : null)
                .endpoint(entity.getEndpointUrl())
                .build();
    }

    McpServerEntity findById(UUID id) {
        String tenantId = TenantContext.getOrDefault();
        return mcpServerRepository.findByIdAndDeletedAtIsNull(id)
                .filter(e -> e.getTenantId().equals(tenantId))
                .orElseThrow(() -> new McpException(ErrorCode.SERVER_NOT_FOUND, "MCP Server 不存在"));
    }

    private McpServerResponse toResponse(McpServerEntity entity) {
        List<UUID> toolIds = mcpToolRepository.findByTenantIdAndServerIdAndDeletedAtIsNull(
                        entity.getTenantId(), entity.getId())
                .stream().map(McpToolEntity::getId).toList();
        return McpServerResponse.builder()
                .id(entity.getId())
                .name(entity.getName())
                .code(entity.getCode())
                .description(entity.getDescription())
                .transportType(entity.getTransportType())
                .endpointUrl(entity.getEndpointUrl())
                .host(entity.getHost())
                .port(entity.getPort())
                .sseEndpoint(entity.getSseEndpoint())
                .authType(entity.getAuthType())
                .authConfig(entity.getAuthConfig())
                .timeoutMs(entity.getTimeoutMs())
                .maxConcurrentCalls(entity.getMaxConcurrentCalls())
                .healthCheckUrl(entity.getHealthCheckUrl())
                .status(toConnectionStatus(entity.getStatus()))
                .lastHeartbeatAt(entity.getLastHeartbeatAt())
                .lastErrorMessage(entity.getLastErrorMessage())
                .toolIds(toolIds)
                .config(entity.getConfig())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }

    private McpServerListItem toListItem(McpServerEntity entity) {
        return McpServerListItem.builder()
                .id(entity.getId())
                .name(entity.getName())
                .code(entity.getCode())
                .transportType(entity.getTransportType())
                .status(toConnectionStatus(entity.getStatus()))
                .toolCount(mcpToolRepository.countByTenantIdAndServerIdAndDeletedAtIsNull(
                        entity.getTenantId(), entity.getId()))
                .lastHeartbeatAt(entity.getLastHeartbeatAt())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }

    private String toConnectionStatus(String status) {
        if (STATUS_ACTIVE.equals(status)) {
            return CONNECTION_ONLINE;
        }
        if (STATUS_ERROR.equals(status)) {
            return CONNECTION_ERROR;
        }
        return CONNECTION_OFFLINE;
    }

    private String normalizeAuthType(String authType) {
        if (authType == null || authType.isBlank()) {
            return "none";
        }
        return authType.toLowerCase();
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

    private String normalizeIdeType(String ideType) {
        if (ideType == null || ideType.isBlank()) {
            return "generic";
        }
        return ideType.toLowerCase().replace("-", "_");
    }

    private String buildFileName(McpServerEntity entity, String ideType) {
        return switch (ideType) {
            case "cursor" -> "mcp.json";
            case "claude_desktop" -> "claude_desktop_config.json";
            case "claude_code" -> ".mcp.json";
            case "copilot" -> "settings.json";
            default -> "mcp-server-" + entity.getCode() + ".json";
        };
    }

    private String buildIdeConfigContent(McpServerEntity entity, String ideType) {
        String serverKey = "mate-platform-" + entity.getCode();
        String endpoint = effectiveEndpoint(entity);
        Map<String, Object> serverBlock = buildServerBlock(entity, endpoint);

        Map<String, Object> root = switch (ideType) {
            case "cursor", "claude_desktop", "generic" -> Map.of("mcpServers", Map.of(serverKey, serverBlock));
            case "claude_code" -> Map.of("servers", Map.of(serverKey, serverBlock));
            case "copilot" -> Map.of("mcp", Map.of("servers", Map.of(serverKey, serverBlock)));
            default -> Map.of("mcpServers", Map.of(serverKey, serverBlock));
        };
        return toJsonString(root);
    }

    private Map<String, Object> buildServerBlock(McpServerEntity entity, String endpoint) {
        boolean isStdio = "STDIO".equalsIgnoreCase(entity.getTransportType());
        if (isStdio) {
            String command = entity.getHost() != null && !entity.getHost().isBlank()
                    ? entity.getHost()
                    : "npx";
            List<String> args = entity.getPort() != null
                    ? List.of("-y", "@anthropic-ai/mcp-proxy", command)
                    : List.of("-y", "@anthropic-ai/mcp-proxy", endpoint);
            Map<String, Object> block = new java.util.LinkedHashMap<>();
            block.put("command", command);
            block.put("args", args);
            if (entity.getAuthConfig() != null && !entity.getAuthConfig().isBlank() && !"{}".equals(entity.getAuthConfig())) {
                block.put("env", Map.of("MCP_AUTH_CONFIG", entity.getAuthConfig()));
            }
            return block;
        }

        Map<String, Object> block = new java.util.LinkedHashMap<>();
        block.put("url", endpoint);
        Map<String, String> headers = new java.util.LinkedHashMap<>();
        if (entity.getAuthConfig() != null && !entity.getAuthConfig().isBlank() && !"{}".equals(entity.getAuthConfig())) {
            try {
                JsonNode authNode = objectMapper.readTree(entity.getAuthConfig());
                if (authNode.has("apiKey")) {
                    headers.put("Authorization", "Bearer " + authNode.get("apiKey").asText());
                } else if (authNode.has("token")) {
                    headers.put("Authorization", "Bearer " + authNode.get("token").asText());
                }
            } catch (Exception e) {
                headers.put("Authorization", "Bearer ${YOUR_API_KEY}");
            }
        }
        if (!headers.isEmpty()) {
            block.put("headers", headers);
        }
        return block;
    }

    private String effectiveEndpoint(McpServerEntity entity) {
        if (entity.getEndpointUrl() != null && !entity.getEndpointUrl().isBlank()) {
            return entity.getEndpointUrl();
        }
        if (entity.getSseEndpoint() != null && !entity.getSseEndpoint().isBlank()) {
            return entity.getSseEndpoint();
        }
        if (entity.getHost() != null && entity.getPort() != null) {
            return "http://" + entity.getHost() + ":" + entity.getPort();
        }
        return "http://localhost:8000/api/v1/mcp/sse/" + entity.getCode();
    }

    private String toJsonString(Object value) {
        try {
            return objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(value);
        } catch (Exception e) {
            throw new McpException(ErrorCode.INTERNAL_ERROR, "无法序列化 IDE 配置");
        }
    }
}
