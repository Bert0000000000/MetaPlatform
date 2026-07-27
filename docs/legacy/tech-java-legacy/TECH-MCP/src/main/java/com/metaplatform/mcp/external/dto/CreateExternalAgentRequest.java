package com.metaplatform.mcp.external.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.Data;

@Data
public class CreateExternalAgentRequest {

    @NotBlank(message = "name 不能为空")
    private String name;

    private String description;

    @NotBlank(message = "endpoint 不能为空")
    private String endpoint;

    @Pattern(regexp = "MCP|A2A|BOTH", message = "protocolType 必须是 MCP、A2A 或 BOTH")
    private String protocolType;

    @Pattern(regexp = "none|apikey|oauth2|bearer", message = "authType 必须是 none、apikey、oauth2 或 bearer")
    private String authType;

    private String authConfig;

    private String capabilities;
}
