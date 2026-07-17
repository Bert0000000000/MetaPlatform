package com.metaplatform.rule.testing.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RuleTestResult {

    private String ruleId;
    private String ruleCode;
    private String ruleName;
    private boolean matched;
    private Map<String, Object> output;
    private long executionTimeMs;
    private String error;
}
