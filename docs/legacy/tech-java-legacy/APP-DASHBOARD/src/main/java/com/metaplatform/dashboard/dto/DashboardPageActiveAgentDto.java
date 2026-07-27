package com.metaplatform.dashboard.dto;

/** 活跃数字员工条目 */
public record DashboardPageActiveAgentDto(
        String dot_class,
        String name,
        String type,
        Integer tasks,
        String status_bg,
        String status_color,
        String status_label
) {}