package com.metaplatform.action.statistics.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TimelinePoint {

    private Instant timestamp;
    private long executionCount;
    private long successCount;
    private long failureCount;
}
