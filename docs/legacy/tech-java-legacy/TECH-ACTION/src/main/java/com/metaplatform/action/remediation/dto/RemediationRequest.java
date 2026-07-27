package com.metaplatform.action.remediation.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RemediationRequest {

    private String anomalyType;
    private String serviceName;
    private String actionCode;
    private String mode;
    private String traceId;
}
