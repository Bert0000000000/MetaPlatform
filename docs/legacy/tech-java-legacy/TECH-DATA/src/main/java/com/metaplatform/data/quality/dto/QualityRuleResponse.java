package com.metaplatform.data.quality.dto;

import com.fasterxml.jackson.databind.JsonNode;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.OffsetDateTime;

/**
 * 质量规则响应。
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class QualityRuleResponse {

    private String id;
    private String tenantId;
    private String name;
    private String targetAssetId;
    private String ruleType;
    private String expression;
    private String severity;
    private JsonNode config;
    private String status;
    private String description;
    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;
}
