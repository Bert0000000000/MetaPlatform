package com.metaplatform.obs.dto.prometheus;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;

import java.util.List;
import java.util.Map;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class PrometheusMetadataResponse {

    private String status;
    private Map<String, List<MetricMetadata>> data;

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class MetricMetadata {
        private String type;
        private String help;
        private String unit;
    }
}
