package com.metaplatform.ea.mapping.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.ea.exception.EaException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.reactive.function.client.ClientResponse;
import org.springframework.web.reactive.function.client.ExchangeFunction;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import reactor.core.publisher.Mono;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class OntIntegrationServiceTest {

    private OntIntegrationService ontIntegrationService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @BeforeEach
    void setUp() {
    }

    @Test
    void conceptExists_shouldReturnTrue_whenConceptFound() {
        WebClient webClient = WebClient.builder()
                .exchangeFunction(buildExchangeFunction(HttpStatus.OK))
                .build();
        ontIntegrationService = new OntIntegrationService(webClient, objectMapper);

        boolean result = ontIntegrationService.conceptExists("concept-001");

        assertThat(result).isTrue();
    }

    @Test
    void conceptExists_shouldReturnFalse_whenConceptNotFound() {
        WebClient webClient = WebClient.builder()
                .exchangeFunction(buildExchangeFunction(HttpStatus.NOT_FOUND))
                .build();
        ontIntegrationService = new OntIntegrationService(webClient, objectMapper);

        boolean result = ontIntegrationService.conceptExists("concept-001");

        assertThat(result).isFalse();
    }

    @Test
    void conceptExists_shouldThrow_whenServiceError() {
        WebClient webClient = WebClient.builder()
                .exchangeFunction(buildExchangeFunction(HttpStatus.INTERNAL_SERVER_ERROR))
                .build();
        ontIntegrationService = new OntIntegrationService(webClient, objectMapper);

        assertThatThrownBy(() -> ontIntegrationService.conceptExists("concept-001"))
                .isInstanceOf(EaException.class)
                .hasMessageContaining("Ontology 服务调用失败");
    }

    @Test
    void validateConceptExists_shouldThrow_whenConceptNotFound() {
        WebClient webClient = WebClient.builder()
                .exchangeFunction(buildExchangeFunction(HttpStatus.NOT_FOUND))
                .build();
        ontIntegrationService = new OntIntegrationService(webClient, objectMapper);

        assertThatThrownBy(() -> ontIntegrationService.validateConceptExists("concept-001"))
                .isInstanceOf(EaException.class)
                .hasMessageContaining("Ontology 概念不存在");
    }

    @Test
    void validateConceptExists_shouldPass_whenConceptFound() {
        WebClient webClient = WebClient.builder()
                .exchangeFunction(buildExchangeFunction(HttpStatus.OK))
                .build();
        ontIntegrationService = new OntIntegrationService(webClient, objectMapper);

        ontIntegrationService.validateConceptExists("concept-001");
    }

    private ExchangeFunction buildExchangeFunction(HttpStatus status) {
        return request -> {
            ClientResponse response = ClientResponse.create(status)
                    .header("Content-Type", "application/json")
                    .body("{}")
                    .build();
            if (status.is4xxClientError() || status.is5xxServerError()) {
                return Mono.just(response)
                        .flatMap(r -> Mono.error(WebClientResponseException.create(
                                status.value(), status.getReasonPhrase(), null, new byte[0], null)));
            }
            return Mono.just(response);
        };
    }
}
