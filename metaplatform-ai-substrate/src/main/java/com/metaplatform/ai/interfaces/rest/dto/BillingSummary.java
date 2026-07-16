package com.metaplatform.ai.interfaces.rest.dto;

import java.util.Map;

public record BillingSummary(
    String tenantId,
    String date,
    long dailyUsage,
    long dailyQuota,
    long remainingQuota,
    Map<String, Long> usageByModel
) {}
