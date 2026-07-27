package com.metaplatform.rag.graph.dto;

import java.util.List;

public record GraphSearchResponse(
    List<GraphSearchResult> results
) {
}
