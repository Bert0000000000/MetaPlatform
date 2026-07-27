package com.metaplatform.gw.audit.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RecordAuditLogRequest {
    private String tenantId;
    private String apiId;
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
}
