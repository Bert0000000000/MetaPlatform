package com.metaplatform.rag.context.dto;

import java.util.List;

public record ContextAssembleResponse(
    String context,
    List<ContextSource> sources
) {
}
