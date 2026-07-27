package com.metaplatform.ea.mapping.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.ea.common.ErrorCode;
import com.metaplatform.ea.exception.EaException;
import com.metaplatform.ea.ontmapping.dto.OntologyConceptSnapshot;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import reactor.core.publisher.Mono;

import java.util.HashMap;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class OntIntegrationService {

    private final WebClient ontWebClient;
    private final ObjectMapper objectMapper;

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

    public OntologyConceptSnapshot getConcept(String conceptId) {
        try {
            JsonNode root = ontWebClient.get()
                    .uri("/api/v1/ont/concepts/{conceptId}", conceptId)
                    .retrieve()
                    .bodyToMono(JsonNode.class)
                    .block();
            return parseConceptSnapshot(root);
        } catch (WebClientResponseException.NotFound e) {
            return null;
        } catch (Exception e) {
            log.error("Failed to get concept {} from Ontology service", conceptId, e);
            throw new EaException(ErrorCode.ONT_SERVICE_ERROR, "Ontology 服务调用失败: " + e.getMessage());
        }
    }

    public boolean updateConcept(String conceptId, String name, String description) {
        try {
            Map<String, Object> body = new HashMap<>();
            if (name != null) body.put("name", name);
            if (description != null) body.put("description", description);
            ontWebClient.put()
                    .uri("/api/v1/ont/concepts/{conceptId}", conceptId)
                    .bodyValue(body)
                    .retrieve()
                    .toBodilessEntity()
                    .block();
            return true;
        } catch (WebClientResponseException.NotFound e) {
            return false;
        } catch (Exception e) {
            log.error("Failed to update concept {} in Ontology service", conceptId, e);
            return false;
        }
    }

    public OntologyConceptSnapshot createConcept(String code, String name, String description, String parentConceptId) {
        try {
            Map<String, Object> body = new HashMap<>();
            body.put("code", code);
            body.put("name", name);
            body.put("description", description);
            if (parentConceptId != null) body.put("parentConceptId", parentConceptId);
            JsonNode root = ontWebClient.post()
                    .uri("/api/v1/ont/concepts")
                    .bodyValue(body)
                    .retrieve()
                    .bodyToMono(JsonNode.class)
                    .block();
            return parseConceptSnapshot(root);
        } catch (Exception e) {
            log.error("Failed to create concept {} in Ontology service", code, e);
            throw new EaException(ErrorCode.ONT_SERVICE_ERROR, "Ontology 服务调用失败: " + e.getMessage());
        }
    }

    private OntologyConceptSnapshot parseConceptSnapshot(JsonNode root) {
        if (root == null) return null;
        JsonNode data = root.has("data") ? root.get("data") : root;
        if (data == null || data.isNull()) return null;
        return OntologyConceptSnapshot.builder()
                .conceptId(getText(data, "conceptId"))
                .conceptCode(getText(data, "code"))
                .name(getText(data, "name"))
                .description(getText(data, "description"))
                .parentConceptId(getText(data, "parentConceptId"))
                .build();
    }

    private String getText(JsonNode node, String field) {
        return node.has(field) && !node.get(field).isNull() ? node.get(field).asText() : null;
    }
}
