package com.metaplatform.obs.anomaly.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RemediationRequest {

    /**
     * ADVISE: 仅生成建议
     * AUTO: 直接执行修复 Action
     */
    private String mode;

    private String actionCode;
}
