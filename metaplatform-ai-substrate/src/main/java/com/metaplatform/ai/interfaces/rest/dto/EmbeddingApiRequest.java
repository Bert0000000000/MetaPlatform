package com.metaplatform.ai.interfaces.rest.dto;

import java.util.List;

public record EmbeddingApiRequest(
    String model,
    List<String> texts
) {}
