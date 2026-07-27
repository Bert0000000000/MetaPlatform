package com.metaplatform.dashboard.dto;

public record DashboardPageMyDeliverableDto(
        String name,
        String type_label,
        String type_class,
        String project,
        String gen_class,
        String gen_name,
        String format,
        String size,
        String date,
        String status,
        String status_class,
        String icon
) {}