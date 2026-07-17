package com.metaplatform.obs.trace.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TopologyNode {
    private String service;
    private String status;
    private long callCount;
    private double avgDurationMs;
}