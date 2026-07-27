package com.metaplatform.mcp.debug.dto;

import lombok.Data;

import java.util.Map;
import java.util.UUID;

@Data
public class DebugExecuteRequest {

    private UUID serverId;
    private UUID toolId;
    private Map<String, Object> requestPayload;
    private boolean breakpoint;
}
