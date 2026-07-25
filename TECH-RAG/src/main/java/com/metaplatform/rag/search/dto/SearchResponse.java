package com.metaplatform.rag.search.dto;

import java.util.List;

public record SearchResponse(
    List<SearchResult> results
) {
}
