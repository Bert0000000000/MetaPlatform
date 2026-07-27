package com.metaplatform.llmgw.audit.dto;

public record AuditStatisticsDto(
        Long totalRequests,
        Long totalInputTokens,
        Long totalOutputTokens,
        Long totalTokens,
        Long totalLatencyMs,
        Double averageLatencyMs
) {
}
