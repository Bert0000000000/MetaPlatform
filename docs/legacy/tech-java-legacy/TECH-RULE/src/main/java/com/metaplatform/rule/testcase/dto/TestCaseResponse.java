package com.metaplatform.rule.testcase.dto;

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
public class TestCaseResponse {

    private String id;
    private String tenantId;
    private String ruleId;
    private String rulesetId;
    private String targetType;
    private String targetId;
    private String name;
    private Map<String, Object> input;
    private Map<String, Object> expectedOutput;
    private Map<String, Object> actualOutput;
    private String status;
    private Instant createdAt;
    private Instant updatedAt;
}
