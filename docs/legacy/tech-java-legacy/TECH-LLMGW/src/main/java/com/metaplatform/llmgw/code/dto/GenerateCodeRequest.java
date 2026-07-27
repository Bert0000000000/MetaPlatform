package com.metaplatform.llmgw.code.dto;

public record GenerateCodeRequest(
        String prompt,
        String language,
        String context
) {
}
