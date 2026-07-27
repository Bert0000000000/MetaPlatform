package com.metaplatform.rule.dto;

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
public class RuleSetVersionResponse {

    private String id;
    private String rulesetId;
    private Integer versionNumber;
    private String description;
    private String status;
    private Map<String, Object> snapshot;
    private Instant createdAt;
    private String createdBy;
}
