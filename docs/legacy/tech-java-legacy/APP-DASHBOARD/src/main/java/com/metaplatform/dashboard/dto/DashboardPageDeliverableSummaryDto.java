package com.metaplatform.dashboard.dto;

import java.util.List;

/** Deliverables 页面聚合：复用现有 dashboard_deliverables 表 + V5 timeline */
public record DashboardPageDeliverableSummaryDto(
        List<DashboardPageMyDeliverableDto> deliverables,
        List<DashboardPageDeliverableTimelineDto> timeline
) {}