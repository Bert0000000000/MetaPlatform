package com.metaplatform.mcp.a2a;

import com.metaplatform.mcp.common.TenantContext;
import com.metaplatform.mcp.tool.entity.McpToolEntity;
import com.metaplatform.mcp.tool.service.McpToolService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * MCP Tool 列表 → A2A Agent Card.skills 转换桥接器。
 *
 * <p>v1.3 协议互通：TECH-MCP 作为 MCP Server 暴露 ONT/RAG/Action 等工具；
 * TECH-A2A（A2A Nacos Starter）作为 Agent 注册中心需要发现这些"类 Agent 能力"。
 * 本类将 MCP Server 的 tool 列表映射为 A2A Agent Card 的 skills 字段，便于
 * A2A Client 把 MCP Server 当作一个 Agent Card 来发现与调用。</p>
 *
 * <p><b>SAA 类名兼容性说明</b>：SAA 1.1.2.2 中 A2A 相关核心类型位于
 * {@code com.alibaba.cloud.ai.a2a.core.registry} 与
 * {@code com.alibaba.cloud.ai.a2a.registry.nacos.discovery}（如 NacosAgentCardWrapper）。
 * 没有直接的 {@code A2aAgentCard} 顶层类；本桥接器采用「Map / Object」结构返回
 * Agent Card JSON，由调用方（{@code NacosAgentRegistry#register} 或 A2A Client）
 * 解析。后续 SAA 1.2.0+ 若发布统一 {@code AgentCard} 类，可平滑替换返回类型。</p>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class McpA2aCardBridge {

    public static final String DEFAULT_AGENT_VERSION = "1.0.0";

    private final McpToolService toolService;

    /**
     * 构建 A2A Agent Card：skills 字段填充 MCP Server 暴露的工具清单。
     *
     * @param serverName    MCP Server 名（对应 mate-mcp-server-{name}）
     * @param description   Agent 描述
     * @param endpointUrl   Agent Card 可访问 URL（如 .well-known/agent.json）
     * @return Map 表示的 Agent Card JSON（顶层 key: name/description/url/version/skills）
     */
    public Map<String, Object> buildAgentCard(String serverName, String description, String endpointUrl) {
        List<McpToolEntity> tools = safeListActiveTools();
        List<Map<String, Object>> skills = new ArrayList<>();
        for (McpToolEntity tool : tools) {
            Map<String, Object> skill = new LinkedHashMap<>();
            skill.put("id", tool.getId() == null ? null : tool.getId().toString());
            skill.put("name", tool.getCode());
            skill.put("description", tool.getDescription());
            skill.put("version", tool.getVersion());
            skill.put("inputSchema", tool.getInputSchema());
            skill.put("outputSchema", tool.getOutputSchema());
            skill.put("tags", parseTags(tool.getTags()));
            skills.add(skill);
        }

        Map<String, Object> card = new LinkedHashMap<>();
        card.put("name", serverName);
        card.put("description", description);
        card.put("url", endpointUrl);
        card.put("version", DEFAULT_AGENT_VERSION);
        card.put("provider", "mate-platform");
        card.put("skills", skills);
        card.put("protocols", List.of("mcp/2025-03-26", "a2a/0.1"));
        log.debug("Built A2A Agent Card: serverName={} skills={}", serverName, skills.size());
        return card;
    }

    /**
     * 获取 MCP Server 当前 ACTIVE Tool 数（用于 A2A Registry 健康探针）。
     */
    public int countActiveTools() {
        return safeListActiveTools().size();
    }

    private List<McpToolEntity> safeListActiveTools() {
        try {
            String tenantId = TenantContext.getOrDefault();
            return toolService.listEnabled();
        } catch (Exception e) {
            log.warn("Failed to list active MCP tools for A2A Card: {}", e.getMessage());
            return List.of();
        }
    }

    @SuppressWarnings("unchecked")
    private List<String> parseTags(String tagsJson) {
        if (tagsJson == null || tagsJson.isBlank()) {
            return List.of();
        }
        try {
            com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
            return mapper.readValue(tagsJson, List.class);
        } catch (Exception e) {
            return List.of();
        }
    }
}