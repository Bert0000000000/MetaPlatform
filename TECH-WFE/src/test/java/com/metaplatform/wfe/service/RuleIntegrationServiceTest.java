package com.metaplatform.wfe.service;

import com.metaplatform.wfe.dto.RouteDecision;
import com.metaplatform.wfe.exception.WfeException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

/**
 * P1-WFE-07: TECH-RULE 集成测试（mock WebClient）。
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class RuleIntegrationServiceTest {

    @Mock
    private WebClient ruleWebClient;

    @InjectMocks
    private RuleIntegrationService ruleIntegrationService;

    @SuppressWarnings({"unchecked", "rawtypes"})
    private void mockPost(String responseJson) {
        WebClient.RequestBodyUriSpec uriSpec = mock(WebClient.RequestBodyUriSpec.class);
        WebClient.RequestBodySpec bodySpec = mock(WebClient.RequestBodySpec.class);
        WebClient.RequestHeadersSpec headersSpec = mock(WebClient.RequestHeadersSpec.class);
        WebClient.ResponseSpec responseSpec = mock(WebClient.ResponseSpec.class);
        when(ruleWebClient.post()).thenReturn(uriSpec);
        when(uriSpec.uri(anyString())).thenReturn(bodySpec);
        when(bodySpec.header(anyString(), anyString())).thenReturn(bodySpec);
        when(bodySpec.bodyValue(any())).thenReturn(headersSpec);
        when(headersSpec.retrieve()).thenReturn(responseSpec);
        when(responseSpec.bodyToMono(String.class)).thenReturn(Mono.just(responseJson));
    }

    @Test
    void evaluateGateway_shouldReturnFirstMatched() {
        mockPost("{\"code\":0,\"data\":[" +
                "{\"ruleId\":\"r1\",\"ruleCode\":\"RC1\",\"matched\":false,\"action\":{\"type\":\"ROUTE\",\"config\":{}}}," +
                "{\"ruleId\":\"r2\",\"ruleCode\":\"RC2\",\"matched\":true,\"action\":{\"type\":\"ROUTE\",\"config\":{\"target\":\"manager\"}}}" +
                "]}");

        RouteDecision decision = ruleIntegrationService.evaluateGateway(
                "tenant-1", "RS_APPROVAL", Map.of("amount", 5000));

        assertThat(decision).isNotNull();
        assertThat(decision.getRuleId()).isEqualTo("r2");
        assertThat(decision.getRuleCode()).isEqualTo("RC2");
        assertThat(decision.getActionType()).isEqualTo("ROUTE");
        assertThat(decision.getActionConfig()).containsEntry("target", "manager");
    }

    @Test
    void evaluateGateway_shouldReturnNull_whenNoMatch() {
        mockPost("{\"code\":0,\"data\":[" +
                "{\"ruleId\":\"r1\",\"ruleCode\":\"RC1\",\"matched\":false,\"action\":{\"type\":\"ROUTE\",\"config\":{}}}" +
                "]}");

        RouteDecision decision = ruleIntegrationService.evaluateGateway(
                "tenant-1", "RS_APPROVAL", Map.of("amount", 100));

        assertThat(decision).isNull();
    }

    @Test
    void evaluateGateway_shouldThrow_whenWebClientFails() {
        when(ruleWebClient.post()).thenThrow(new RuntimeException("connection refused"));

        assertThatThrownBy(() -> ruleIntegrationService.evaluateGateway("tenant-1", "RS_APPROVAL", Map.of()))
                .isInstanceOf(WfeException.class)
                .hasMessageContaining("规则引擎调用失败");
    }
}
