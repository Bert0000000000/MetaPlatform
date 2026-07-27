package com.metaplatform.dashboard.dto;

/** 统计卡片 — 字段直接以 snake_case 序列化返回给前端 */
public record DashboardPageStatDto(
        String label,
        String value,
        String trend_label,
        String trend_value,
        Boolean trend_up,
        String icon
) {}