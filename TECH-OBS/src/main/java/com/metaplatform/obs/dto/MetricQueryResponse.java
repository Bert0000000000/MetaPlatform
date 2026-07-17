package com.metaplatform.obs.dto;

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
public class MetricQueryResponse {

    private String metricName;
    private List<MetricTimeSeries> results;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class MetricTimeSeries {
        private Map<String, String> labels;
        private List<MetricValue> values;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class MetricValue {
        private long timestamp;
        private double value;
    }
}
