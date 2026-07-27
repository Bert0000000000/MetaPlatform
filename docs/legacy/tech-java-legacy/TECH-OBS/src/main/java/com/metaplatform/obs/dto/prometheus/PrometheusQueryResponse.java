package com.metaplatform.obs.dto.prometheus;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;

import java.util.List;
import java.util.Map;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class PrometheusQueryResponse {

    private String status;
    private PrometheusData data;

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class PrometheusData {
        private String resultType;
        private List<PrometheusResult> result;
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class PrometheusResult {
        private Map<String, String> metric;
        private List<List<Object>> values;
    }
}
