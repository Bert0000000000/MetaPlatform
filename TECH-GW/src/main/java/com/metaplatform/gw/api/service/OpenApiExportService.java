package com.metaplatform.gw.api.service;

import com.metaplatform.gw.api.dto.ApiResponse;
import com.metaplatform.gw.api.entity.GwApiEntity;
import com.metaplatform.gw.api.repository.GwApiRepository;
import com.metaplatform.gw.common.ErrorCode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;
import reactor.core.scheduler.Schedulers;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Generates OpenAPI 3.0 specs (as JSON or YAML) for a single API definition or a group.
 * The exporter is intentionally self-contained: it doesn't depend on any third-party
 * OpenAPI library because Spring Boot starter-gateway does not bring one in transitively.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class OpenApiExportService {

    private final GwApiRepository apiRepository;

    public Mono<ApiResponse> getApiDetail(UUID id) {
        return Mono.fromCallable(() -> apiRepository.findByIdAndDeletedAtIsNull(id)
                        .orElseThrow(() -> new ApiService.ApiException(ErrorCode.NOT_FOUND)))
                .map(ApiResponse::fromEntity)
                .subscribeOn(Schedulers.boundedElastic());
    }

    public Mono<Map<String, Object>> exportOpenApiJson(UUID id) {
        return Mono.fromCallable(() -> {
            GwApiEntity entity = apiRepository.findByIdAndDeletedAtIsNull(id)
                    .orElseThrow(() -> new ApiService.ApiException(ErrorCode.NOT_FOUND));
            return buildSpec(entity);
        }).subscribeOn(Schedulers.boundedElastic());
    }

    public Mono<String> exportOpenApiYaml(UUID id) {
        return exportOpenApiJson(id).map(this::toYaml);
    }

    public Mono<Map<String, Object>> exportOpenApiForGroup(String groupName, String tenantId) {
        return Mono.fromCallable(() -> {
            List<GwApiEntity> entities = apiRepository
                    .findByTenantIdAndGroupNameAndDeletedAtIsNull(
                            com.metaplatform.gw.common.TenantContext.resolveOrDefault(tenantId),
                            groupName);
            return buildCombinedSpec(entities, groupName);
        }).subscribeOn(Schedulers.boundedElastic());
    }

    private Map<String, Object> buildSpec(GwApiEntity entity) {
        return buildCombinedSpec(List.of(entity), entity.getGroupName());
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> buildCombinedSpec(List<GwApiEntity> entities, String groupName) {
        Map<String, Object> spec = new LinkedHashMap<>();
        spec.put("openapi", "3.0.3");
        spec.put("info", Map.of(
                "title", groupName == null ? "Mate Platform API" : groupName,
                "version", "1.0.0",
                "description", "Exported from TECH-GW API catalog"
        ));
        spec.put("servers", List.of(Map.of("url", "/")));
        Map<String, Object> paths = new LinkedHashMap<>();
        Map<String, Object> components = new LinkedHashMap<>();
        Map<String, Object> schemas = new LinkedHashMap<>();

        for (GwApiEntity entity : entities) {
            if (entity == null) continue;
            String path = entity.getPath();
            paths.computeIfAbsent(path, k -> new LinkedHashMap<>());
            Map<String, Object> operation = new LinkedHashMap<>();
            operation.put("summary", entity.getName());
            operation.put("operationId", safeId(entity));
            operation.put("tags", entity.getGroupName() != null ? List.of(entity.getGroupName()) : List.of());

            if (entity.getDescription() != null) {
                operation.put("description", entity.getDescription());
            }
            if (entity.getParameters() != null && !entity.getParameters().isEmpty()) {
                operation.put("parameters", entity.getParameters());
            }
            Map<String, Object> requestBody = buildRequestBody(entity);
            if (requestBody != null) {
                operation.put("requestBody", requestBody);
            }
            operation.put("responses", buildResponses(entity, schemas));

            ((Map<String, Object>) paths.get(path))
                    .put(entity.getMethod().toLowerCase(), operation);
        }
        if (!schemas.isEmpty()) {
            components.put("schemas", schemas);
        }
        if (!components.isEmpty()) {
            spec.put("components", components);
        }
        spec.put("paths", paths);
        return spec;
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> buildRequestBody(GwApiEntity entity) {
        if (entity.getRequestSchema() == null || entity.getRequestSchema().isEmpty()) {
            return null;
        }
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("required", true);
        Map<String, Object> content = new LinkedHashMap<>();
        Map<String, Object> schema = new LinkedHashMap<>();
        schema.put("schema", entity.getRequestSchema());
        if (entity.getExamples() != null && !entity.getExamples().isEmpty()) {
            schema.put("examples", entity.getExamples());
        }
        content.put("application/json", schema);
        body.put("content", content);
        return body;
    }

    private Map<String, Object> buildResponses(GwApiEntity entity, Map<String, Object> schemas) {
        Map<String, Object> responses = new LinkedHashMap<>();
        Map<String, Object> ok = new LinkedHashMap<>();
        ok.put("description", "Successful operation");
        if (entity.getResponseSchema() != null && !entity.getResponseSchema().isEmpty()) {
            Map<String, Object> content = new LinkedHashMap<>();
            content.put("application/json", Map.of("schema", entity.getResponseSchema()));
            ok.put("content", content);
            schemas.put(safeId(entity) + "Response", entity.getResponseSchema());
        }
        responses.put("200", ok);
        if (entity.getRequestSchema() != null && !entity.getRequestSchema().isEmpty()) {
            schemas.put(safeId(entity) + "Request", entity.getRequestSchema());
        }
        return responses;
    }

    private static String safeId(GwApiEntity entity) {
        String name = entity.getName() == null ? "api" : entity.getName();
        return name.replaceAll("[^A-Za-z0-9_]", "_") + "_" +
                (entity.getId() != null ? entity.getId().toString().substring(0, 8) : UUID.randomUUID().toString().substring(0, 8));
    }

    /**
     * Convert the OpenAPI document to a lightweight YAML representation.
     * We intentionally avoid a YAML library to keep the gateway dependency surface minimal.
     */
    @SuppressWarnings("unchecked")
    private String toYaml(Map<String, Object> spec) {
        StringBuilder sb = new StringBuilder();
        writeYaml(sb, spec, 0);
        return sb.toString();
    }

    @SuppressWarnings("unchecked")
    private void writeYaml(StringBuilder sb, Object value, int indent) {
        String pad = repeat("  ", indent);
        if (value instanceof Map<?, ?> map) {
            for (Map.Entry<?, ?> entry : map.entrySet()) {
                Object v = entry.getValue();
                if (v == null) continue;
                if (v instanceof Map<?, ?> || v instanceof List<?>) {
                    sb.append(pad).append(entry.getKey()).append(":\n");
                    writeYaml(sb, v, indent + 1);
                } else {
                    sb.append(pad).append(entry.getKey()).append(": ").append(formatScalar(v)).append("\n");
                }
            }
        } else if (value instanceof List<?> list) {
            for (Object item : list) {
                sb.append(pad).append("- ");
                if (item instanceof Map<?, ?> || item instanceof List<?>) {
                    sb.append("\n");
                    writeYaml(sb, item, indent + 1);
                } else {
                    sb.append(formatScalar(item)).append("\n");
                }
            }
        } else if (value != null) {
            sb.append(pad).append(formatScalar(value)).append("\n");
        }
    }

    private String formatScalar(Object value) {
        if (value == null) return "null";
        if (value instanceof Number || value instanceof Boolean) return value.toString();
        String s = value.toString();
        if (s.contains("\n") || s.contains("\"") || s.contains("'")) {
            return "\"" + s.replace("\"", "\\\"") + "\"";
        }
        return s;
    }

    private String repeat(String s, int times) {
        return String.join("", Collections.nCopies(times, s));
    }
}
