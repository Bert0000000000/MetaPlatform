package com.metaplatform.gw.audit.dto;

import com.metaplatform.gw.audit.entity.GwAuditLogEntity;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AuditLogResponse {
    private UUID id;
    private String tenantId;
    private UUID apiId;
    private String path;
    private String method;
    private Integer statusCode;
    private Long requestSize;
    private Long responseSize;
    private Long durationMs;
    private String userId;
    private String traceId;
    private String clientIp;
    private String errorMessage;
    private Boolean isError;
    private LocalDateTime createdAt;

    public static AuditLogResponse fromEntity(GwAuditLogEntity entity) {
        return AuditLogResponse.builder()
                .id(entity.getId())
                .tenantId(entity.getTenantId())
                .apiId(entity.getApiId())
                .path(entity.getPath())
                .method(entity.getMethod())
                .statusCode(entity.getStatusCode())
                .requestSize(entity.getRequestSize())
                .responseSize(entity.getResponseSize())
                .durationMs(entity.getDurationMs())
                .userId(entity.getUserId())
                .traceId(entity.getTraceId())
                .clientIp(entity.getClientIp())
                .errorMessage(entity.getErrorMessage())
                .isError(entity.getIsError())
                .createdAt(entity.getCreatedAt())
                .build();
    }
}
