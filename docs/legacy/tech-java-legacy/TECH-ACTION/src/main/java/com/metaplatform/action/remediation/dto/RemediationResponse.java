package com.metaplatform.action.remediation.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RemediationResponse {

    private boolean executed;
    private String actionCode;
    private String actionName;
    private String message;
    private String executionId;
}
