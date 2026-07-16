package com.metaplatform.rule.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RuleSetResponse {

    private String id;
    private String tenantId;
    private String code;
    private String name;
    private String description;
    private String status;
    private Integer priority;
    private Integer version;
    private Instant createdAt;
    private Instant updatedAt;
    private String createdBy;
    private String updatedBy;
}
