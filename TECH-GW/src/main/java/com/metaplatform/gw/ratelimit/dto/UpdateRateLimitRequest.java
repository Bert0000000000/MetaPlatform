package com.metaplatform.gw.ratelimit.dto;

import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UpdateRateLimitRequest {

    private String ruleName;

    private String description;

    private String scope;

    private String limitType;

    private Integer qpsLimit;

    private Integer concurrentLimit;

    private Long tokenLimit;

    private String tokenWindow;

    private Double burstFactor;

    private Integer quotaAlertThreshold;

    @NotNull(message = "version 不能为空")
    private Integer version;
}
