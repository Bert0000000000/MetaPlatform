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
public class ConnectionStatusResponse {

    private UUID id;
    private String name;
    private String type;
    private String transportType;
    private String status;
    private String connectionStatus;
    private Instant lastHeartbeatAt;
    private String lastErrorMessage;
    private Double errorRate;
    private Long latencyMs;
    private String endpoint;
}
