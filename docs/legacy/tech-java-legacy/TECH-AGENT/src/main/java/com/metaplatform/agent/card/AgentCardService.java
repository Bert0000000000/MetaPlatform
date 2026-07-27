package com.metaplatform.agent.card;

import com.metaplatform.agent.agents.AgentService;
import com.metaplatform.agent.agents.dto.AgentResponse;
import com.metaplatform.agent.card.dto.AgentCardResponse;
import com.metaplatform.agent.config.AgentProperties;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Agent Card 生成服务：生成 A2A 兼容的 Agent Card。
 *
 * <p>对应 Python {@code app.card.service.AgentCardService}。</p>
 */
@Service
@RequiredArgsConstructor
public class AgentCardService {

    private static final String PROTOCOL_VERSION = "0.3.0";
    private static final String CARD_VERSION = "1.0.0";
    private static final String DEFAULT_BASE_URL = "http://localhost:8501";

    private final AgentService agentService;
    private final AgentProperties agentProperties;

    /**
     * 生成 A2A 兼容的 Agent Card。
     *
     * @param tenantId 租户 ID
     * @param agentId  Agent ID
     * @param baseUrl  服务基础地址（可为 null，使用默认值）
     */
    @Transactional(readOnly = true)
    public AgentCardResponse generateCard(String tenantId, String agentId, String baseUrl) {
        AgentResponse agent = agentService.get(tenantId, agentId);
        return buildCard(agent, tenantId, baseUrl);
    }

    /**
     * 使用默认 baseUrl 生成 Agent Card。
     */
    @Transactional(readOnly = true)
    public AgentCardResponse generateCard(String tenantId, String agentId) {
        return generateCard(tenantId, agentId, null);
    }

    private AgentCardResponse buildCard(AgentResponse agent, String tenantId, String baseUrl) {
        String effectiveBaseUrl = baseUrl != null && !baseUrl.isBlank() ? baseUrl : DEFAULT_BASE_URL;

        // 构建 skills 列表
        List<Map<String, Object>> skills = new ArrayList<>();
        if (agent.getTools() != null) {
            for (String tool : agent.getTools()) {
                Map<String, Object> skill = new LinkedHashMap<>();
                skill.put("id", tool);
                skill.put("name", tool);
                skill.put("description", "Tool: " + tool);
                skills.add(skill);
            }
        }

        // 若有 rag_scopes，添加 rag-retrieval skill
        if (agent.getRagScopes() != null && !agent.getRagScopes().isEmpty()) {
            Map<String, Object> ragSkill = new LinkedHashMap<>();
            ragSkill.put("id", "rag-retrieval");
            ragSkill.put("name", "Knowledge Retrieval");
            ragSkill.put("description", "Retrieve from: " + String.join(", ", agent.getRagScopes()));
            skills.add(ragSkill);
        }

        // 构建 endpoints
        List<Map<String, Object>> endpoints = new ArrayList<>();
        endpoints.add(buildEndpoint("sync",
                effectiveBaseUrl + "/api/v1/agent/agents/" + agent.getAgentId() + "/execute",
                "Synchronous execution endpoint"));
        endpoints.add(buildEndpoint("stream",
                effectiveBaseUrl + "/api/v1/agent/agents/" + agent.getAgentId() + "/execute/stream",
                "SSE streaming execution endpoint"));

        // capabilities
        Map<String, Object> capabilities = new LinkedHashMap<>();
        capabilities.put("streaming", true);
        capabilities.put("pushNotifications", false);
        capabilities.put("stateTransition", true);

        // authentication
        Map<String, Object> authentication = new LinkedHashMap<>();
        authentication.put("scheme", "bearer");
        authentication.put("description", "JWT Bearer token authentication");

        // metadata
        Map<String, Object> metadata = new LinkedHashMap<>();
        metadata.put("agentCode", agent.getCode());
        metadata.put("modelId", agent.getModelId());
        metadata.put("status", agent.getStatus());
        metadata.put("tenantId", tenantId);

        return AgentCardResponse.builder()
                .context("https://www.w3.org/ns/agent-card/v1")
                .type("AgentCard")
                .id("agent:" + agent.getAgentId())
                .name(agent.getName())
                .description(agent.getDescription() != null && !agent.getDescription().isBlank()
                        ? agent.getDescription() : "Agent: " + agent.getName())
                .version(CARD_VERSION)
                .protocolVersion(PROTOCOL_VERSION)
                .capabilities(capabilities)
                .endpoints(endpoints)
                .authentication(authentication)
                .skills(skills)
                .defaultInputModes(List.of("text"))
                .defaultOutputModes(List.of("text"))
                .metadata(metadata)
                .build();
    }

    private Map<String, Object> buildEndpoint(String type, String url, String description) {
        Map<String, Object> endpoint = new LinkedHashMap<>();
        endpoint.put("type", type);
        endpoint.put("url", url);
        endpoint.put("description", description);
        return endpoint;
    }
}
