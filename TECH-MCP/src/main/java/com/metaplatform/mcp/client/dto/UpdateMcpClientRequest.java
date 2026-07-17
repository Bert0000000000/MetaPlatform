package com.metaplatform.mcp.client.dto;

import lombok.Data;

@Data
public class UpdateMcpClientRequest {

    private String name;
    private String serverUrl;
    private String transportType;
    private String config;
}
