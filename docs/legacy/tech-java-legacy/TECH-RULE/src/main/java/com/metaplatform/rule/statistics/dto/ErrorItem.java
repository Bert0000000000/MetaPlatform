package com.metaplatform.rule.statistics.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ErrorItem {
    private String id;
    private String targetType;
    private String targetId;
    private LocalDate executionDate;
    private int errorCount;
    private int totalCount;
    private double errorRate;
}
