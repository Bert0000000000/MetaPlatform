package com.metaplatform.mcp.client.dto;

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
public class McpClientResponse {

    private UUID id;
    private String name;
    private String serverUrl;
    private String baseUrl;
    private String clientType;
    private String transportType;
    private String status;
    private String authType;
    private String authToken;
    private Integer timeoutMs;
    private String headers;
    private String serverIds;
    private Instant lastConnectedAt;
    private String config;
    private Instant createdAt;
    private Instant updatedAt;
}
