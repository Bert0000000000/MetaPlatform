package com.metaplatform.base.integration;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.*;
import org.springframework.web.client.RestTemplate;

import java.util.*;

public class RestConnector implements Connector {

    private static final Logger log = LoggerFactory.getLogger(RestConnector.class);

    private final String connectorId;
    private final String baseUrl;
    private final RestTemplate restTemplate;

    public RestConnector(String connectorId, String baseUrl, RestTemplate restTemplate) {
        this.connectorId = connectorId;
        this.baseUrl = baseUrl;
        this.restTemplate = restTemplate;
    }

    @Override
    public String id() {
        return connectorId;
    }

    @Override
    public String type() {
        return "REST";
    }

    @Override
    public boolean testConnection() {
        try {
            ResponseEntity<String> response = restTemplate.getForEntity(baseUrl, String.class);
            return response.getStatusCode().is2xxSuccessful();
        } catch (Exception e) {
            log.warn("Connection test failed for connector {}: {}", connectorId, e.getMessage());
            return false;
        }
    }

    @Override
    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> pull(PullRequest request) {
        String url = buildUrl(request.endpoint(), request.queryParams());
        HttpHeaders headers = buildHeaders(request.headers());

        HttpEntity<Void> entity = new HttpEntity<>(headers);
        ResponseEntity<Map[]> response = restTemplate.exchange(
                url, HttpMethod.GET, entity, Map[].class);

        if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
            return List.of();
        }

        FieldMapping mapping = request.fieldMapping();
        List<Map<String, Object>> results = new ArrayList<>();
        for (Map<String, Object> item : response.getBody()) {
            results.add(mapping.transformInbound(item));
        }
        return results;
    }

    @Override
    public PushResult push(PushRequest request) {
        String url = buildUrl(request.endpoint(), Map.of());
        HttpHeaders headers = buildHeaders(request.headers());
        headers.setContentType(MediaType.APPLICATION_JSON);

        FieldMapping mapping = request.fieldMapping();
        Map<String, Object> transformedPayload = mapping.transformOutbound(request.payload());

        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(transformedPayload, headers);

        try {
            ResponseEntity<String> response = restTemplate.exchange(
                    url, HttpMethod.POST, entity, String.class);
            return new PushResult(
                    response.getStatusCode().is2xxSuccessful(),
                    response.getStatusCode().value(),
                    response.getBody(),
                    null
            );
        } catch (Exception e) {
            return new PushResult(false, 0, null, e.getMessage());
        }
    }

    private String buildUrl(String endpoint, Map<String, String> queryParams) {
        StringBuilder sb = new StringBuilder(baseUrl);
        if (!endpoint.startsWith("/")) sb.append("/");
        sb.append(endpoint);

        if (queryParams != null && !queryParams.isEmpty()) {
            sb.append("?");
            queryParams.forEach((k, v) -> sb.append(k).append("=").append(v).append("&"));
            sb.setLength(sb.length() - 1); // 去掉最后的 &
        }
        return sb.toString();
    }

    private HttpHeaders buildHeaders(Map<String, String> headers) {
        HttpHeaders httpHeaders = new HttpHeaders();
        if (headers != null) {
            headers.forEach(httpHeaders::add);
        }
        return httpHeaders;
    }
}
