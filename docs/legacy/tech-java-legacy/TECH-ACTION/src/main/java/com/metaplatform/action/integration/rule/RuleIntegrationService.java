package com.metaplatform.action.integration.rule;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.action.common.ErrorCode;
import com.metaplatform.action.exception.ActionException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.time.Duration;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class RuleIntegrationService {

    private static final Duration TIMEOUT = Duration.ofSeconds(10);

    private final WebClient.Builder webClientBuilder;
    private final ObjectMapper objectMapper;

    @Value("${action.integration.rule.base-url:http://localhost:8501}")
    private String ruleBaseUrl;

    public JsonNode evaluateRuleset(String rulesetId, Object input) {
        try {
            String response = client()
                    .post()
                    .uri("/api/v1/rule/rulesets/{id}/execute", rulesetId)
                    .contentType(MediaType.APPLICATION_JSON)
                    .bodyValue(input == null ? Map.of() : input)
                    .retrieve()
                    .bodyToMono(String.class)
                    .block(TIMEOUT);
            if (response == null) {
                throw new ActionException(ErrorCode.RULE_EVALUATION_ERROR, "规则引擎返回空结果");
            }
            return objectMapper.readTree(response);
        } catch (ActionException e) {
            throw e;
        } catch (Exception e) {
            log.error("Failed to evaluate ruleset {} via TECH-RULE", rulesetId, e);
            throw new ActionException(ErrorCode.RULE_EVALUATION_ERROR,
                    "规则引擎求值失败: " + e.getMessage());
        }
    }

    public String resolveTargetNodeId(JsonNode ruleResult, String resultKey) {
        if (ruleResult == null) {
            throw new ActionException(ErrorCode.RULE_EVALUATION_ERROR, "规则求值结果为空，无法路由");
        }
        JsonNode value = ruleResult;
        if (resultKey != null && !resultKey.isBlank()) {
            value = ruleResult.at("/" + resultKey.replace('.', '/'));
        }
        if (value == null || value.isNull() || value.asText().isBlank()) {
            throw new ActionException(ErrorCode.RULE_EVALUATION_ERROR,
                    "规则求值结果缺少路由字段: " + resultKey);
        }
        return value.asText();
    }

    private WebClient client() {
        return webClientBuilder.clone().baseUrl(ruleBaseUrl).build();
    }
}
