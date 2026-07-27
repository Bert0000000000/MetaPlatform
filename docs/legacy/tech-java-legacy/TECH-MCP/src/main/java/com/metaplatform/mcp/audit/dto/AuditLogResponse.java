package com.metaplatform.mcp.audit.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AuditLogResponse {

    private UUID id;
    private UUID toolId;
    private String toolCode;
    private UUID serverId;
    private UUID clientId;
    private String invocationType;
    private Integer inputTokens;
    private Integer outputTokens;
    private Long durationMs;
    private String status;
    private String errorMessage;
    private String traceId;
    private String userId;
    private Instant calledAt;
}