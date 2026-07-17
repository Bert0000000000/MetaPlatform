package com.metaplatform.action.integration.rule;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.action.common.ErrorCode;
import com.metaplatform.action.exception.ActionException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.AdditionalAnswers;
import org.springframework.http.MediaType;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RuleIntegrationServiceTest {

    @Mock
    private WebClient.Builder webClientBuilder;

    private final ObjectMapper objectMapper = new ObjectMapper();

    private RuleIntegrationService ruleIntegrationService;

    @BeforeEach
    void setUp() {
        ruleIntegrationService = new RuleIntegrationService(webClientBuilder, objectMapper);
        ReflectionTestUtils.setField(ruleIntegrationService, "ruleBaseUrl", "http://localhost:8501");
    }

    @Test
    @SuppressWarnings("unchecked")
    void evaluateRuleset_shouldReturnJsonNode_whenRuleSucceeds() {
        WebClient.Builder clonedBuilder = mock(WebClient.Builder.class);
        WebClient client = mock(WebClient.class);
        WebClient.RequestBodyUriSpec requestSpec = mock(WebClient.RequestBodyUriSpec.class, AdditionalAnswers.RETURNS_SELF);
        WebClient.ResponseSpec responseSpec = mock(WebClient.ResponseSpec.class);

        when(webClientBuilder.clone()).thenReturn(clonedBuilder);
        when(clonedBuilder.baseUrl(anyString())).thenReturn(clonedBuilder);
        when(clonedBuilder.build()).thenReturn(client);
        when(client.post()).thenReturn(requestSpec);
        when(requestSpec.retrieve()).thenReturn(responseSpec);
        when(responseSpec.bodyToMono(eq(String.class))).thenReturn(Mono.just("{\"target\":\"node-2\"}"));

        JsonNode result = ruleIntegrationService.evaluateRuleset("rs-1", Map.of("amount", 100));

        assertThat(result.path("target").asText()).isEqualTo("node-2");
    }

    @Test
    void evaluateRuleset_shouldThrow_whenRuleUnavailable() {
        when(webClientBuilder.clone()).thenThrow(new RuntimeException("TECH-RULE connection refused"));

        assertThatThrownBy(() -> ruleIntegrationService.evaluateRuleset("rs-1", Map.of()))
                .isInstanceOf(ActionException.class)
                .satisfies(e -> assertThat(((ActionException) e).getErrorCode())
                        .isEqualTo(ErrorCode.RULE_EVALUATION_ERROR))
                .hasMessageContaining("TECH-RULE connection refused");
    }

    @Test
    void resolveTargetNodeId_shouldReturnValue_whenKeyPresent() throws Exception {
        JsonNode ruleResult = objectMapper.readTree("{\"target\":\"node-2\"}");

        String target = ruleIntegrationService.resolveTargetNodeId(ruleResult, "target");

        assertThat(target).isEqualTo("node-2");
    }

    @Test
    void resolveTargetNodeId_shouldReturnValue_whenNoResultKey() throws Exception {
        JsonNode ruleResult = objectMapper.readTree("node-3");

        String target = ruleIntegrationService.resolveTargetNodeId(ruleResult, null);

        assertThat(target).isEqualTo("node-3");
    }

    @Test
    void resolveTargetNodeId_shouldThrow_whenResultMissing() throws Exception {
        JsonNode ruleResult = objectMapper.readTree("{\"other\":\"value\"}");

        assertThatThrownBy(() -> ruleIntegrationService.resolveTargetNodeId(ruleResult, "target"))
                .isInstanceOf(ActionException.class)
                .satisfies(e -> assertThat(((ActionException) e).getErrorCode())
                        .isEqualTo(ErrorCode.RULE_EVALUATION_ERROR));
    }

    @Test
    void resolveTargetNodeId_shouldThrow_whenResultNull() {
        assertThatThrownBy(() -> ruleIntegrationService.resolveTargetNodeId(null, "target"))
                .isInstanceOf(ActionException.class)
                .hasMessageContaining("规则求值结果为空");
    }
}
