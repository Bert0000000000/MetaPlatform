package com.metaplatform.rule.testing.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DecisionTableTestResult {

    private String tableId;
    private List<Map<String, Object>> matchedOutputs;
    private int matchedRowCount;
    private long executionTimeMs;
}
