package com.metaplatform.msg.dto;

import com.metaplatform.msg.entity.DlqRetryPolicyEntity;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RetryPolicyResponse {

    private String id;
    private String tenantId;
    private String topic;
    private Integer maxRetries;
    private Integer retryIntervalSeconds;
    private Double retryBackoffMultiplier;
    private Integer autoCleanupDays;
    private Instant createdAt;
    private Instant updatedAt;

    public static RetryPolicyResponse from(DlqRetryPolicyEntity e) {
        return RetryPolicyResponse.builder()
                .id(e.getId())
                .tenantId(e.getTenantId())
                .topic(e.getTopic())
                .maxRetries(e.getMaxRetries())
                .retryIntervalSeconds(e.getRetryIntervalSeconds())
                .retryBackoffMultiplier(e.getRetryBackoffMultiplier())
                .autoCleanupDays(e.getAutoCleanupDays())
                .createdAt(e.getCreatedAt())
                .updatedAt(e.getUpdatedAt())
                .build();
    }
}
