package com.metaplatform.dashboard.dto;

public record DashboardSummaryDto(long todoCount, long unreadNotificationCount,
                                  long activeTaskCount, long newMetricCount) {
}
