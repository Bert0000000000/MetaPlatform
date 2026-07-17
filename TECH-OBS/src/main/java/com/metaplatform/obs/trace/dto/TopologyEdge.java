package com.metaplatform.obs.trace.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TopologyEdge {
    private String source;
    private String target;
    private long callCount;
    private double avgDurationMs;
}