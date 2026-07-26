package com.metaplatform.dashboard.dto;

public record DashboardPageMyAppDto(
        String name,
        String type,
        String type_label,
        String description,
        String last_used,
        String date,
        String usage,
        String icon,
        Boolean pinned
) {}