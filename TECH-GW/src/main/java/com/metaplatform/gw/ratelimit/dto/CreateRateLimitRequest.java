package com.metaplatform.gw.ratelimit.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreateRateLimitRequest {

    @NotBlank(message = "ruleName 不能为空")
    private String ruleName;

    private String description;

    private String routeId;

    @NotBlank(message = "scope 不能为空")
    private String scope;

    @NotBlank(message = "limitType 不能为空")
    private String limitType;

    private Integer qpsLimit;

    private Integer concurrentLimit;

    private Long tokenLimit;

    private String tokenWindow;

    private Double burstFactor;

    private Integer quotaAlertThreshold;

    private String status;
}
