package com.metaplatform.wfe.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.wfe.common.ErrorCode;
import com.metaplatform.wfe.common.TraceContext;
import com.metaplatform.wfe.dto.RouteDecision;
import com.metaplatform.wfe.exception.WfeException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.Iterator;
import java.util.Map;

/**
 * TECH-RULE 集成：网关条件路由（P1-WFE-07）。
 */
@Slf4j
@Service
public class RuleIntegrationService {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    private final WebClient ruleWebClient;

    public RuleIntegrationService(@Qualifier("ruleWebClient") WebClient ruleWebClient) {
        this.ruleWebClient = ruleWebClient;
    }

    /**
     * 调用规则引擎执行规则集，返回第一个 matched=true 的规则动作作为路由决策。
     */
    public RouteDecision evaluateGateway(String tenantId, String rulesetCode, Map<String, Object> inputData) {
        try {
            Map<String, Object> body = Map.of("data", inputData != null ? inputData : Map.of());

            String json = ruleWebClient.post()
                    .uri("/api/v1/rule/rulesets/" + rulesetCode + "/execute")
                    .header("X-Tenant-Id", tenantId)
                    .header(TraceContext.TRACE_ID_HEADER, TraceContext.getOrCreate())
                    .bodyValue(body)
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();

            return parseFirstMatched(json);
        } catch (Exception e) {
            log.error("Failed to evaluate gateway from RULE: tenantId={}, rulesetCode={}, error={}",
                    tenantId, rulesetCode, e.getMessage());
            throw new WfeException(ErrorCode.RULE_EVALUATION_FAILED, "规则引擎调用失败: " + e.getMessage());
        }
    }

    @SuppressWarnings("unchecked")
    private RouteDecision parseFirstMatched(String json) throws Exception {
        if (json == null || json.isBlank()) {
            return null;
        }
        JsonNode root = OBJECT_MAPPER.readTree(json);
        JsonNode data = root.path("data");
        if (data.isMissingNode() || !data.isArray()) {
            return null;
        }
        Iterator<JsonNode> it = data.elements();
        while (it.hasNext()) {
            JsonNode rule = it.next();
            boolean matched = rule.path("matched").asBoolean(false);
            if (matched) {
                JsonNode action = rule.path("action");
                Map<String, Object> config = null;
                JsonNode configNode = action.path("config");
                if (configNode.isObject()) {
                    config = OBJECT_MAPPER.convertValue(configNode, Map.class);
                }
                return RouteDecision.builder()
                        .ruleId(rule.path("ruleId").asText(null))
                        .ruleCode(rule.path("ruleCode").asText(null))
                        .actionType(action.path("type").asText(null))
                        .actionConfig(config)
                        .build();
            }
        }
        return null;
    }
}
