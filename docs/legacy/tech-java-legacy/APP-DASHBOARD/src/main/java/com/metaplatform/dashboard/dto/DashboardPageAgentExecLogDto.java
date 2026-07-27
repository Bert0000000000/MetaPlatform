package com.metaplatform.dashboard.dto;

public record DashboardPageAgentExecLogDto(
        String log_id,
        String agent,
        String agent_id,
        String exec_time,
        String duration,
        String status,
        String status_class,
        String dot_class,
        String trigger,
        String tokens
) {}