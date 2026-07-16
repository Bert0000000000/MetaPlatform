package com.metaplatform.ai.vector;

import java.util.Map;

/**
 * Vector search result.
 */
public record SearchResult(
    String id,
    float score,
    Map<String, Object> metadata
) {
    /**
     * Create a result with score
     */
    public static SearchResult of(String id, float score, Map<String, Object> metadata) {
        return new SearchResult(id, score, metadata);
    }
}
