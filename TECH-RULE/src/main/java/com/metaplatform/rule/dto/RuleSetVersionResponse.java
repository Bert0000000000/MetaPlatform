package com.metaplatform.rule.dto;

import com.fasterxml.jackson.databind.JsonNode;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

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
    private JsonNode snapshot;
    private Instant createdAt;
    private String createdBy;
}
