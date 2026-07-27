package com.metaplatform.dashboard.dto;

/** 快捷入口（写死在前端常量里；这里提供后端版本以便后续接入用户自定义） */
public record DashboardPageQuickLinkDto(
        String id,
        String label,
        String icon,
        String link
) {}