package com.metaplatform.rule.testing.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RulesetTestResult {

    private String rulesetId;
    private List<RuleTestResult> results;
    private long executionTimeMs;
    private int matchedCount;
}
