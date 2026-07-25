package com.metaplatform.rag.graph.dto;

import java.util.UUID;

public record GraphSearchRequest(
    String query,
    UUID kbId,
    Integer topK
) {
}
