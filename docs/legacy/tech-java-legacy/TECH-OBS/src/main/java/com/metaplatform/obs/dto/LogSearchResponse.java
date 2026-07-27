package com.metaplatform.obs.dto;

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
public class LogSearchResponse {

    private long total;
    private int page;
    private int pageSize;
    private long totalPages;
    private List<LogSearchResult> results;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class LogSearchResult {
        private Instant timestamp;
        private String service;
        private String level;
        private String message;
        private List<Highlight> highlights;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Highlight {
        private int start;
        private int end;
        private String text;
    }
}
