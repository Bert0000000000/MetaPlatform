package com.metaplatform.llmgw.code.dto;

import java.util.Map;

public record CreateCodeTemplateRequest(
        String name,
        String description,
        String language,
        String templateText,
        Map<String, Object> variables,
        Boolean isActive
) {
}
