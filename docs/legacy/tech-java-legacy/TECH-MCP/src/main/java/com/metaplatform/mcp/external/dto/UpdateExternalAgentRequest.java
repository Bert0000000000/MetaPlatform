package com.metaplatform.mcp.external.dto;

import jakarta.validation.constraints.Pattern;
import lombok.Data;

@Data
public class UpdateExternalAgentRequest {

    private String name;

    private String description;

    private String endpoint;

    @Pattern(regexp = "MCP|A2A|BOTH", message = "protocolType 必须是 MCP、A2A 或 BOTH")
    private String protocolType;

    @Pattern(regexp = "ACTIVE|INACTIVE|ERROR", message = "status 必须是 ACTIVE、INACTIVE 或 ERROR")
    private String status;

    @Pattern(regexp = "TRUSTED|UNTRUSTED|BLOCKED", message = "trustLevel 必须是 TRUSTED、UNTRUSTED 或 BLOCKED")
    private String trustLevel;

    @Pattern(regexp = "none|apikey|oauth2|bearer", message = "authType 必须是 none、apikey、oauth2 或 bearer")
    private String authType;

    private String authConfig;

    private String capabilities;
}
