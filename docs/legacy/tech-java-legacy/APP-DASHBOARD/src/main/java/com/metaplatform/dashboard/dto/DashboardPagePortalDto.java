package com.metaplatform.dashboard.dto;

public record DashboardPagePortalDto(
        String name,
        String kind,
        String description,
        String icon,
        Integer visits,
        String last_visit,
        String url
) {}