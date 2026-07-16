package com.metaplatform.wfe.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProcessInstanceResponse {

    private String id;
    private String tenantId;
    private String processDefinitionId;
    private String processKey;
    private String businessKey;
    private String status;
    private String startUserId;
    private Map<String, Object> variables;
    private Instant createdAt;
    private Instant completedAt;
    private Instant updatedAt;
}
