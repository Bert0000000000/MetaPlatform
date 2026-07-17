package com.metaplatform.mcp.server.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class CreateMcpServerRequest {

    @NotBlank(message = "name 不能为空")
    private String name;

    @NotBlank(message = "code 不能为空")
    private String code;

    private String description;

    @NotBlank(message = "transportType 不能为空")
    private String transportType;

    private String endpointUrl;

    private String config;
}
