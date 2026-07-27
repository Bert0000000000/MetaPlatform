package com.metaplatform.mcp.audit.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TrendPoint {

    private Instant time;
    private long count;
    private long errorCount;
    private long tokenCount;
    private double avgDuration;
}