package com.metaplatform.ea.mapping.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ConsistencyCheckResponse {
    private boolean consistent;
    private long totalMappings;
    private long directMappings;
    private long derivedMappings;
    private long abstractMappings;
    private List<Issue> issues;
    private String summary;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Issue {
        private String severity;
        private String code;
        private String message;
        private String entityReference;
    }
}