package com.metaplatform.llmgw.prompts.dto;

import java.util.Map;

public record RenderPromptRequest(
    Long promptId,
    Map<String, Object> variables
) {}
