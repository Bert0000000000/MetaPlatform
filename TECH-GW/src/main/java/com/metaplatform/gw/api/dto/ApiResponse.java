package com.metaplatform.gw.api.dto;

import com.metaplatform.gw.api.entity.GwApiEntity;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.Map;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ApiResponse {

    private UUID id;
    private String tenantId;
    private String name;
    private String path;
    private String method;
    private String groupName;
    private String version;
    private String targetService;
    private String description;
    private String status;
    private Map<String, Object> metadata;
    private Map<String, Object> requestSchema;
    private Map<String, Object> responseSchema;
    private Map<String, Object> parameters;
    private Map<String, Object> examples;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public static ApiResponse fromEntity(GwApiEntity entity) {
        return ApiResponse.builder()
                .id(entity.getId())
                .tenantId(entity.getTenantId())
                .name(entity.getName())
                .path(entity.getPath())
                .method(entity.getMethod())
                .groupName(entity.getGroupName())
                .version(entity.getVersion())
                .targetService(entity.getTargetService())
                .description(entity.getDescription())
                .status(entity.getStatus())
                .metadata(safeMap(entity.getMetadata()))
                .requestSchema(safeMap(entity.getRequestSchema()))
                .responseSchema(safeMap(entity.getResponseSchema()))
                .parameters(safeMap(entity.getParameters()))
                .examples(safeMap(entity.getExamples()))
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }

    public static ApiResponse fromEntityLite(GwApiEntity entity) {
        return ApiResponse.builder()
                .id(entity.getId())
                .tenantId(entity.getTenantId())
                .name(entity.getName())
                .path(entity.getPath())
                .method(entity.getMethod())
                .groupName(entity.getGroupName())
                .version(entity.getVersion())
                .targetService(entity.getTargetService())
                .description(entity.getDescription())
                .status(entity.getStatus())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }

    private static Map<String, Object> safeMap(Map<String, Object> map) {
        return map == null ? Collections.emptyMap() : map;
    }
}
