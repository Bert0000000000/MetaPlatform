package com.metaplatform.dashboard.dto;

/** 系统健康条目 */
public record DashboardPageSystemHealthDto(
        String dot_class,
        String name,
        String detail,
        String status
) {}