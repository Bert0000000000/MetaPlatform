package com.metaplatform.mcp.audit.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AnalyticsItem {

    private String dimension;
    private String dimensionKey;
    private long count;
    private long errorCount;
    private long tokenCount;
    private double avgDuration;
}
