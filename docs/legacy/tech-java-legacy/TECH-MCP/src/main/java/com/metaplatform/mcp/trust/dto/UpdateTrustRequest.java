package com.metaplatform.mcp.trust.dto;

import jakarta.validation.constraints.Pattern;
import lombok.Data;

import java.time.Instant;

@Data
public class UpdateTrustRequest {

    @Pattern(regexp = "TRUSTED|UNTRUSTED|BLOCKED", message = "trustLevel 必须是 TRUSTED、UNTRUSTED 或 BLOCKED")
    private String trustLevel;

    private String reason;

    private String allowedOperations;

    private Instant expiresAt;
}
