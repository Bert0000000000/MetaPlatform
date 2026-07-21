package com.metaplatform.mcp.collaboration.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import lombok.Data;

import java.time.Instant;

@Data
public class CreateCollaborationAuditRequest {

    @NotBlank(message = "callerId 不能为空")
    private String callerId;

    @Pattern(regexp = "AGENT|USER|APP", message = "callerType 必须是 AGENT、USER 或 APP")
    private String callerType;

    @NotBlank(message = "calleeId 不能为空")
    private String calleeId;

    @Pattern(regexp = "AGENT|SERVER|TOOL", message = "calleeType 必须是 AGENT、SERVER 或 TOOL")
    private String calleeType;

    private String operation;

    @Pattern(regexp = "MCP|A2A", message = "protocolType 必须是 MCP 或 A2A")
    private String protocolType;

    @Pattern(regexp = "SUCCESS|ERROR|TIMEOUT", message = "status 必须是 SUCCESS、ERROR 或 TIMEOUT")
    private String status;

    @NotNull(message = "durationMs 不能为空")
    private Long durationMs;

    private String requestPayload;

    private String responsePayload;

    private String errorMessage;

    private String traceId;

    private Instant calledAt;
}
