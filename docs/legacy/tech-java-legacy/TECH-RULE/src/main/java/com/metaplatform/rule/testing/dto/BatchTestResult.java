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
public class BatchTestResult {

    private List<RuleTestResult> results;
    private int totalCount;
    private int matchedCount;
    private int errorCount;
    private long totalExecutionTimeMs;
}
