package com.metaplatform.dashboard.dto;

import java.util.List;

public record SearchResponse(
        String keyword,
        long total,
        List<SearchResultItem> items
) {
    public record SearchResultItem(
            String type,
            String id,
            String title,
            String description,
            String url
    ) {
    }
}
