package com.metaplatform.mcp.server.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ServerStatusResponse {

    private String status;
    private String connectionStatus;
    private Instant lastHeartbeatAt;
    private String lastErrorMessage;
    private String healthCheckUrl;
    private Long responseTimeMs;
}
