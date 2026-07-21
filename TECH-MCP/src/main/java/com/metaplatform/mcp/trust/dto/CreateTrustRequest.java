package com.metaplatform.mcp.trust.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import lombok.Data;

import java.time.Instant;
import java.util.UUID;

@Data
public class CreateTrustRequest {

    @NotNull(message = "agentId 不能为空")
    private UUID agentId;

    @NotBlank(message = "trustLevel 不能为空")
    @Pattern(regexp = "TRUSTED|UNTRUSTED|BLOCKED", message = "trustLevel 必须是 TRUSTED、UNTRUSTED 或 BLOCKED")
    private String trustLevel;

    private String reason;

    private String allowedOperations;

    private Instant expiresAt;
}
