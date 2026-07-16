package com.metaplatform.gw.route.dto;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.gw.route.entity.GwRouteEntity;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Slf4j
public class RouteResponse {

    private String id;
    private String tenantId;
    private String routeId;
    private String name;
    private String uri;
    private List<Map<String, Object>> predicates;
    private List<Map<String, Object>> filters;
    private Integer priority;
    private Boolean enabled;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    private static final ObjectMapper objectMapper = new ObjectMapper();
    private static final TypeReference<List<Map<String, Object>>> listTypeRef = new TypeReference<>() {};

    public static RouteResponse fromEntity(GwRouteEntity entity) {
        List<Map<String, Object>> predicates = parseJson(entity.getPredicates());
        List<Map<String, Object>> filters = parseJson(entity.getFilters());

        return RouteResponse.builder()
                .id(entity.getId())
                .tenantId(entity.getTenantId())
                .routeId(entity.getRouteId())
                .name(entity.getName())
                .uri(entity.getUri())
                .predicates(predicates)
                .filters(filters)
                .priority(entity.getPriority())
                .enabled(entity.getEnabled())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }

    private static List<Map<String, Object>> parseJson(String json) {
        if (json == null || json.isBlank()) {
            return List.of();
        }
        try {
            return objectMapper.readValue(json, listTypeRef);
        } catch (Exception e) {
            log.warn("Failed to parse JSON: {}", json, e);
            return List.of();
        }
    }
}
