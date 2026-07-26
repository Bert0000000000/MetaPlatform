package com.metaplatform.dashboard.dto;

public record DashboardPageMessageDto(
        String msg_id,
        String sender,
        String avatar_class,
        String icon,
        String title,
        String summary,
        String time,
        String priority,
        Boolean unread,
        Integer attachments
) {}