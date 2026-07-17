package com.metaplatform.action.integration.ont;

import com.metaplatform.action.common.ErrorCode;
import com.metaplatform.action.exception.ActionException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.time.Duration;

@Slf4j
@Service
@RequiredArgsConstructor
public class OntologyIntegrationService {

    private static final Duration TIMEOUT = Duration.ofSeconds(10);

    private final WebClient.Builder webClientBuilder;

    @Value("${action.integration.ont.base-url:http://localhost:8201}")
    private String ontBaseUrl;

    public boolean validateEntity(String entityId) {
        if (entityId == null || entityId.isBlank()) {
            return true;
        }
        try {
            String response = client()
                    .get()
                    .uri("/api/v1/ont/entities/{id}", entityId)
                    .retrieve()
                    .bodyToMono(String.class)
                    .block(TIMEOUT);
            return response != null && !response.isBlank();
        } catch (Exception e) {
            log.error("Failed to validate ontology entity {} via TECH-ONT", entityId, e);
            throw new ActionException(ErrorCode.DEPENDENCY_ERROR,
                    "TECH-ONT 实体校验失败: " + e.getMessage());
        }
    }

    private WebClient client() {
        return webClientBuilder.clone().baseUrl(ontBaseUrl).build();
    }
}
