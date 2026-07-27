package com.metaplatform.dashboard.dto;

import java.util.List;

/**
 * 工作台页面聚合响应（/api/v1/dashboard/page/summary）
 * 字段命名保持 snake_case，与前端 api/dashboard.ts 的 DashboardSummary 类型对齐
 */
public record DashboardPageSummaryDto(
        List<DashboardPageStatDto> stats,
        List<DashboardPageRecentTaskDto> recentTasks,
        long recentTasksTotal,
        List<DashboardPageSystemHealthDto> systemHealth,
        List<DashboardPageActiveAgentDto> activeAgents,
        List<DashboardPageQuickLinkDto> quickLinks
) {}