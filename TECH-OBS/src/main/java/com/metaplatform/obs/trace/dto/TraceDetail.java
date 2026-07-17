package com.metaplatform.obs.trace.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TraceDetail {
    private String traceId;
    private Instant startTime;
    private long durationUs;
    private String rootService;
    private int spanCount;
    private int errorCount;
    private List<Span> spans;
}