package com.metaplatform.llmgw.prompts.dto;

import java.util.Map;

public record RenderTemplateRequest(
    String templateText,
    Map<String, Object> variables
) {}
