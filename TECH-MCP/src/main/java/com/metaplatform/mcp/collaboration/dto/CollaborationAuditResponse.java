package com.metaplatform.mcp.collaboration.dto;

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
public class CollaborationAuditResponse {

    private UUID id;
    private String callerId;
    private String callerType;
    private String calleeId;
    private String calleeType;
    private String operation;
    private String protocolType;
    private String status;
    private Long durationMs;
    private String requestPayload;
    private String responsePayload;
    private String errorMessage;
    private String traceId;
    private Instant calledAt;
}
