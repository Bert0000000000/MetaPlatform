package com.metaplatform.rag.context.dto;

import java.util.List;
import java.util.UUID;

public record ContextAssembleRequest(
    String query,
    List<UUID> kbIds,
    List<String> history,
    Boolean enableGraph
) {
}
