package com.metaplatform.llmgw.code.dto;

import java.util.Map;

public record RenderTemplateRequest(
        Map<String, Object> variables
) {
}
