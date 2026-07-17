package com.metaplatform.ea.mapping.service;

import com.metaplatform.ea.common.ErrorCode;
import com.metaplatform.ea.exception.EaException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import reactor.core.publisher.Mono;

@Slf4j
@Service
@RequiredArgsConstructor
public class OntIntegrationService {

    private final WebClient ontWebClient;

    public boolean conceptExists(String conceptId) {
        try {
            return ontWebClient.get()
                    .uri("/api/v1/ont/concepts/{conceptId}", conceptId)
                    .retrieve()
                    .toBodilessEntity()
                    .map(response -> response.getStatusCode().is2xxSuccessful())
                    .onErrorResume(WebClientResponseException.NotFound.class, e -> Mono.just(false))
                    .block();
        } catch (WebClientResponseException.NotFound e) {
            return false;
        } catch (Exception e) {
            log.error("Failed to validate concept {} in Ontology service", conceptId, e);
            throw new EaException(ErrorCode.ONT_SERVICE_ERROR, "Ontology 服务调用失败: " + e.getMessage());
        }
    }

    public void validateConceptExists(String conceptId) {
        if (!conceptExists(conceptId)) {
            throw new EaException(ErrorCode.NOT_FOUND, "Ontology 概念不存在: " + conceptId);
        }
    }
}
