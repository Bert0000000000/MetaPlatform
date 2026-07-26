package com.metaplatform.dashboard.dto;

import java.math.BigDecimal;

public record DashboardPageMyAgentDto(
        String name,
        String type,
        String type_label,
        String status,
        String status_class,
        String description,
        Integer tasks,
        BigDecimal success_rate,
        String icon
) {}