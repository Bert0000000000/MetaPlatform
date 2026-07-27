package com.metaplatform.mcp.debug.dto;

import lombok.Data;

import java.util.UUID;

@Data
public class CreateBreakpointRequest {

    private UUID toolId;
    private String condition;
    private Boolean enabled;
}
