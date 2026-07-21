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
public class McpServerListItem {

    private UUID id;
    private String name;
    private String code;
    private String transportType;
    private String status;
    private long toolCount;
    private Instant lastHeartbeatAt;
    private Instant createdAt;
    private Instant updatedAt;
}
