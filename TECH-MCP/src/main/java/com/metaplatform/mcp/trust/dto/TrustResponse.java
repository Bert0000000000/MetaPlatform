package com.metaplatform.mcp.trust.dto;

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
public class TrustResponse {

    private UUID id;
    private UUID agentId;
    private String agentName;
    private String trustLevel;
    private String reason;
    private String allowedOperations;
    private Instant expiresAt;
    private Instant createdAt;
    private Instant updatedAt;
}
