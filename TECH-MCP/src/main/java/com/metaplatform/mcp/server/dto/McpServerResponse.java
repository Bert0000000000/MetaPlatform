package com.metaplatform.mcp.server.dto;

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
public class McpServerResponse {

    private UUID id;
    private String name;
    private String code;
    private String description;
    private String transportType;
    private String endpointUrl;
    private String status;
    private String config;
    private Instant createdAt;
    private Instant updatedAt;
}
