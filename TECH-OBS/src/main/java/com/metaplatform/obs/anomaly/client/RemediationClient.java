package com.metaplatform.obs.anomaly.client;

import com.metaplatform.obs.anomaly.dto.RemediationResult;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.util.Map;

@Slf4j
@Component
public class RemediationClient {

    private final RestClient restClient;

    public RemediationClient(RestClient.Builder restClientBuilder,
                             @Value("${app.obs.remediation.base-url:http://localhost:8104}") String baseUrl) {
        this.restClient = restClientBuilder.baseUrl(baseUrl).build();
    }

    public RemediationResult remediate(String anomalyType, String serviceName, String actionCode,
                                       String mode, String traceId) {
        Map<String, Object> body = Map.of(
                "anomalyType", anomalyType,
                "serviceName", serviceName,
                "actionCode", actionCode != null ? actionCode : "",
                "mode", mode != null ? mode : "ADVISE",
                "traceId", traceId != null ? traceId : "");
        try {
            return restClient.post()
                    .uri("/api/v1/action/remediate")
                    .body(body)
                    .retrieve()
                    .body(RemediationResult.class);
        } catch (RestClientException e) {
            log.warn("Failed to call remediation service: {}", e.getMessage());
            return RemediationResult.builder()
                    .executed(false)
                    .actionCode(actionCode)
                    .message("修复服务调用失败，请人工处理: " + e.getMessage())
                    .build();
        }
    }
}
