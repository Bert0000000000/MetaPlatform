package com.metaplatform.mcp.external.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ExternalAgentTestResult {

    private boolean success;
    private Long responseTimeMs;
    private String message;
    private String protocolType;
}
