package com.metaplatform.rag.citations.dto;

import java.util.List;

public record CitationLocateRequest(
    String query,
    String answer,
    List<CitationSourceDto> chunks
) {
}
