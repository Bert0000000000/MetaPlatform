package com.metaplatform.mcp.debug.dto;

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
public class BreakpointResponse {

    private UUID id;
    private UUID sessionId;
    private UUID toolId;
    private String condition;
    private Boolean enabled;
    private Instant createdAt;
    private Instant updatedAt;
}
