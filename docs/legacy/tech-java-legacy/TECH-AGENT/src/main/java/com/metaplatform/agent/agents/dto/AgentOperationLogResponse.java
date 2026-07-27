package com.metaplatform.agent.agents.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.OffsetDateTime;

/**
 * Agent 操作审计日志响应。
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AgentOperationLogResponse {

    private String id;
    private String actor;
    private String action;
    private String resource;
    private OffsetDateTime timestamp;
    private String ip;
    private String status;
    private String traceId;
}
