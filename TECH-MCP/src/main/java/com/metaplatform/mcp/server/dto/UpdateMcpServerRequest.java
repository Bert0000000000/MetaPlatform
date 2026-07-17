package com.metaplatform.mcp.server.dto;

import lombok.Data;

@Data
public class UpdateMcpServerRequest {

    private String name;
    private String description;
    private String transportType;
    private String endpointUrl;
    private String config;
}
