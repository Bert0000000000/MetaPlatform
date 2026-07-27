package com.metaplatform.llmgw.code.dto;

import java.util.List;

public record CreateCodeSnippetRequest(
        Long templateId,
        String title,
        String language,
        String codeText,
        String description,
        List<String> tags,
        Integer version
) {
}
