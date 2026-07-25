package com.metaplatform.llmgw.prompts.dto;

import java.util.Map;

public record CreatePromptRequest(
    String name,
    String description,
    String category,
    String templateText,
    Map<String, Object> variables
) {}
