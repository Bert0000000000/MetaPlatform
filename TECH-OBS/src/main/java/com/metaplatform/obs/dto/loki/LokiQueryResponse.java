package com.metaplatform.obs.dto.loki;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

import java.util.List;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class LokiQueryResponse {

    private String status;
    private LokiData data;
    private String error;

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class LokiData {
        private String resultType;
        private Result result;
        private List<LokiStream> streams;
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Result {
        @JsonProperty("matrix")
        private List<List<Object>> matrix;
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class LokiStream {
        private LokiStreamLabels stream;
        private List<List<String>> values;
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class LokiStreamLabels {
        @JsonProperty("service")
        private String service;
        @JsonProperty("level")
        private String level;
        @JsonProperty("job")
        private String job;
    }
}
