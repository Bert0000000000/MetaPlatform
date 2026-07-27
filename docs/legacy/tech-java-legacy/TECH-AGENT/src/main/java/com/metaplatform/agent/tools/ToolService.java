package com.metaplatform.agent.tools;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.agent.clients.ActionClient;
import com.metaplatform.agent.clients.RAGClient;
import com.metaplatform.agent.common.ErrorCode;
import com.metaplatform.agent.common.TenantContext;
import com.metaplatform.agent.entity.AgentToolEntity;
import com.metaplatform.agent.exception.AgentException;
import com.metaplatform.agent.repository.AgentToolRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Agent 工具服务：注册、查询、更新、启用/禁用、删除、调用。
 *
 * <p>调用时按工具类型分发：ACTION → {@link ActionClient}，RAG → {@link RAGClient}，
 * HTTP/BEAN → mock 响应。客户端由并行任务提供实现，未就绪时以 required=false 注入。</p>
 */
@Slf4j
@Service
public class ToolService {

    private static final TypeReference<Map<String, Object>> MAP_TYPE = new TypeReference<>() {};

    private final AgentToolRepository repository;
    private final ObjectMapper objectMapper;
    private final ActionClient actionClient;
    private final RAGClient ragClient;

    @Autowired
    public ToolService(AgentToolRepository repository,
                       ObjectMapper objectMapper,
                       @Autowired(required = false) ActionClient actionClient,
                       @Autowired(required = false) RAGClient ragClient) {
        this.repository = repository;
        this.objectMapper = objectMapper;
        this.actionClient = actionClient;
        this.ragClient = ragClient;
    }

    /**
     * 注册工具。
     */
    public ToolResponse register(String tenantId, CreateToolRequest request) {
        String toolId = "tool-" + UUID.randomUUID().toString().replace("-", "").substring(0, 24);

        AgentToolEntity entity = new AgentToolEntity();
        entity.setId(toolId);
        entity.setTenantId(tenantId);
        entity.setAgentId(request.getAgentId());
        entity.setName(request.getName());
        entity.setDescription(request.getDescription());
        entity.setToolType(request.getToolType() != null ? request.getToolType() : "ACTION");
        entity.setConfig(toJson(request.getConfig() != null ? request.getConfig() : Map.of()));
        entity.setInputSchema(toJson(request.getInputSchema()));
        entity.setOutputSchema(toJson(request.getOutputSchema()));
        entity.setEnabled(boolToStr(request.getEnabled() != null ? request.getEnabled() : true));

        entity = repository.save(entity);
        return toResponse(entity);
    }

    /**
     * 查询工具详情。
     */
    public ToolResponse get(String tenantId, String toolId) {
        AgentToolEntity entity = repository.findByIdAndTenantId(toolId, tenantId)
                .orElseThrow(() -> AgentException.toolNotFound(toolId));
        return toResponse(entity);
    }

    /**
     * 查询工具列表。
     */
    public List<ToolResponse> list(String tenantId, String agentId, boolean enabledOnly) {
        List<AgentToolEntity> entities;
        if (enabledOnly) {
            entities = repository.findByTenantIdAndAgentIdAndEnabled(tenantId, agentId, "true");
        } else {
            entities = repository.findByTenantIdAndAgentId(tenantId, agentId);
        }
        return entities.stream().map(this::toResponse).toList();
    }

    /**
     * 更新工具。
     */
    public ToolResponse update(String tenantId, String toolId, UpdateToolRequest request) {
        AgentToolEntity entity = repository.findByIdAndTenantId(toolId, tenantId)
                .orElseThrow(() -> AgentException.toolNotFound(toolId));

        if (request.getName() != null) {
            entity.setName(request.getName());
        }
        if (request.getDescription() != null) {
            entity.setDescription(request.getDescription());
        }
        if (request.getToolType() != null) {
            entity.setToolType(request.getToolType());
        }
        if (request.getConfig() != null) {
            entity.setConfig(toJson(request.getConfig()));
        }
        if (request.getInputSchema() != null) {
            entity.setInputSchema(toJson(request.getInputSchema()));
        }
        if (request.getOutputSchema() != null) {
            entity.setOutputSchema(toJson(request.getOutputSchema()));
        }

        entity = repository.save(entity);
        return toResponse(entity);
    }

    /**
     * 启用工具。
     */
    public ToolResponse enable(String tenantId, String toolId) {
        AgentToolEntity entity = repository.findByIdAndTenantId(toolId, tenantId)
                .orElseThrow(() -> AgentException.toolNotFound(toolId));
        entity.setEnabled("true");
        entity = repository.save(entity);
        return toResponse(entity);
    }

    /**
     * 禁用工具。
     */
    public ToolResponse disable(String tenantId, String toolId) {
        AgentToolEntity entity = repository.findByIdAndTenantId(toolId, tenantId)
                .orElseThrow(() -> AgentException.toolNotFound(toolId));
        entity.setEnabled("false");
        entity = repository.save(entity);
        return toResponse(entity);
    }

    /**
     * 删除工具。
     */
    public boolean delete(String tenantId, String toolId) {
        AgentToolEntity entity = repository.findByIdAndTenantId(toolId, tenantId)
                .orElseThrow(() -> AgentException.toolNotFound(toolId));
        repository.delete(entity);
        return true;
    }

    /**
     * 调用工具（按类型分发）。
     */
    public Map<String, Object> invoke(String tenantId, String toolId, Map<String, Object> input) {
        AgentToolEntity entity = repository.findByIdAndTenantId(toolId, tenantId)
                .orElseThrow(() -> AgentException.toolNotFound(toolId));

        if (!"true".equals(entity.getEnabled())) {
            throw AgentException.invalidParam("工具已禁用: toolId=" + toolId);
        }

        Map<String, Object> config = fromJson(entity.getConfig());
        String toolType = entity.getToolType();
        String traceId = TenantContext.getTraceId();

        return switch (toolType) {
            case "ACTION" -> invokeAction(entity, config, input, tenantId, traceId);
            case "RAG" -> invokeRag(entity, config, input, tenantId, traceId);
            case "HTTP" -> Map.of("status", "SUCCESS", "output",
                    Map.of("message", "HTTP tool invocation (mock)", "input", input));
            case "BEAN" -> Map.of("status", "SUCCESS", "output",
                    Map.of("message", "Bean tool invocation (mock)", "input", input));
            default -> throw AgentException.invalidParam("不支持的工具类型: " + toolType);
        };
    }

    // ----------------------------------------------------------- dispatch

    @SuppressWarnings("unchecked")
    private Map<String, Object> invokeAction(AgentToolEntity entity, Map<String, Object> config,
                                             Map<String, Object> input, String tenantId, String traceId) {
        if (actionClient == null) {
            throw AgentException.invalidParam("Action 客户端未配置");
        }
        String actionCode = entity.getName();
        if (config != null && config.get("actionCode") instanceof String ac) {
            actionCode = ac;
        }
        Map<String, Object> result = actionClient.execute(actionCode, input, tenantId, traceId);
        Object output = result.getOrDefault("output", result);
        return Map.of("status", "SUCCESS", "output", output);
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> invokeRag(AgentToolEntity entity, Map<String, Object> config,
                                          Map<String, Object> input, String tenantId, String traceId) {
        if (ragClient == null) {
            throw AgentException.invalidParam("RAG 客户端未配置");
        }
        String query = input != null && input.get("query") instanceof String q
                ? q : String.valueOf(input);
        List<String> knowledgeBaseIds = null;
        if (config != null && config.get("knowledgeBaseIds") instanceof List<?> list) {
            knowledgeBaseIds = list.stream()
                    .filter(o -> o instanceof String)
                    .map(o -> (String) o)
                    .toList();
        }
        List<Map<String, Object>> results = ragClient.search(
                query, knowledgeBaseIds, 5, tenantId, traceId);
        return Map.of("status", "SUCCESS", "output", Map.of("results", results));
    }

    // ----------------------------------------------------------- helpers

    private ToolResponse toResponse(AgentToolEntity entity) {
        return ToolResponse.builder()
                .toolId(entity.getId())
                .tenantId(entity.getTenantId())
                .agentId(entity.getAgentId())
                .name(entity.getName())
                .description(entity.getDescription())
                .toolType(entity.getToolType())
                .config(fromJson(entity.getConfig()))
                .inputSchema(fromJson(entity.getInputSchema()))
                .outputSchema(fromJson(entity.getOutputSchema()))
                .enabled("true".equals(entity.getEnabled()))
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }

    private String toJson(Map<String, Object> data) {
        if (data == null) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(data);
        } catch (JsonProcessingException e) {
            log.warn("序列化 JSON 失败", e);
            return null;
        }
    }

    private Map<String, Object> fromJson(String json) {
        if (json == null || json.isBlank()) {
            return null;
        }
        try {
            return objectMapper.readValue(json, MAP_TYPE);
        } catch (JsonProcessingException e) {
            log.warn("反序列化 JSON 失败: {}", json, e);
            return null;
        }
    }

    private static String boolToStr(boolean value) {
        return value ? "true" : "false";
    }
}
