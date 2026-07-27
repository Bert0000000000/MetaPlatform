package com.metaplatform.rule.testcase.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TestCaseStatistics {

    private long total;
    private long passed;
    private long failed;
    private long pending;
    private double passRate;
}
