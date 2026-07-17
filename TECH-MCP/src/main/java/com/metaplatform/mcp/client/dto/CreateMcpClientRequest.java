package com.metaplatform.mcp.client.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class CreateMcpClientRequest {

    @NotBlank(message = "name 不能为空")
    private String name;

    @NotBlank(message = "serverUrl 不能为空")
    private String serverUrl;

    private String transportType;

    private String config;
}
