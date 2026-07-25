package com.metaplatform.agent.agents.dto;

import com.fasterxml.jackson.databind.JsonNode;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.OffsetDateTime;

/**
 * Agent 版本快照响应。
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AgentVersionResponse {

    private String version;
    private OffsetDateTime timestamp;
    private String changeLog;
    private JsonNode snapshot;
    private String createdBy;
}
