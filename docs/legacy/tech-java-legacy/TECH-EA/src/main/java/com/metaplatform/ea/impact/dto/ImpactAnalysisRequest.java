package com.metaplatform.ea.impact.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 影响分析请求：给定 capabilityId 返回受影响资产清单。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ImpactAnalysisRequest {

    @NotBlank(message = "capabilityId 不能为空")
    private String capabilityId;
}
