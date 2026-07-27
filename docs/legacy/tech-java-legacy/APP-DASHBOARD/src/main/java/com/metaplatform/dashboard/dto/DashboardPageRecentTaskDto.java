package com.metaplatform.dashboard.dto;

/** 最近任务条目 */
public record DashboardPageRecentTaskDto(
        String name,
        String type_label,
        String type_class,
        String agent,
        String status,
        String status_class,
        String time
) {}