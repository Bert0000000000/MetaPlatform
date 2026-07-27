package com.metaplatform.msg.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RetryPolicyRequest {

    private String tenantId;

    @NotBlank(message = "Topic 不能为空")
    private String topic;

    private Integer maxRetries;
    private Integer retryIntervalSeconds;
    private Double retryBackoffMultiplier;
    private Integer autoCleanupDays;
}
