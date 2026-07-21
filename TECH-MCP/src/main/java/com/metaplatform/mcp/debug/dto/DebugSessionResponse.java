package com.metaplatform.mcp.debug.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DebugSessionResponse {

    private UUID id;
    private UUID serverId;
    private UUID toolId;
    private String method;
    private Map<String, Object> requestPayload;
    private Map<String, Object> responsePayload;
    private String rawRequest;
    private String rawResponse;
    private Long durationMs;
    private String status;
    private String errorMessage;
    private Boolean breakpoint;
    private String traceId;
    private Instant createdAt;
    private Instant updatedAt;
}
