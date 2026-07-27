package com.metaplatform.data.search.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

/**
 * 全局搜索响应。
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SearchResponse {

    private String keyword;
    private long total;
    private List<SearchHit> hits;

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class SearchHit {
        private String id;
        private String type;
        private String name;
        private String description;
        private String source;
        private String highlight;
    }
}
