package com.metaplatform.mcp.external.dto;

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
public class ExternalAgentResponse {

    private UUID id;
    private String name;
    private String description;
    private String endpoint;
    private String protocolType;
    private String status;
    private String trustLevel;
    private String authType;
    private String authConfig;
    private String capabilities;
    private Instant lastConnectedAt;
    private String lastErrorMessage;
    private Instant createdAt;
    private Instant updatedAt;
}
